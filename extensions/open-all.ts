/**
 * pi-reopen 扩展：登记存活 Pi、区分主动退出与被动死亡、提供 Pi 内恢复入口。
 * 核心逻辑在项目 src/*.js（CLI 共用）；本文件只做 Pi 侧适配。
 */
import { realpathSync } from "node:fs";
import { userInfo } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Key } from "@earendil-works/pi-tui";

function resolveSrcDir(): string {
	const candidates: string[] = [];
	if (process.env.PI_WORKSPACE_SRC) candidates.push(process.env.PI_WORKSPACE_SRC);
	try {
		candidates.push(join(dirname(realpathSync(fileURLToPath(import.meta.url))), "..", "src"));
	} catch {
		/* import.meta.url 不可用时忽略 */
	}
	for (const dir of candidates) {
		try {
			realpathSync(join(dir, "restore.js"));
			return dir;
		} catch {
			/* 尝试下一个候选 */
		}
	}
	throw new Error("无法定位 pi-reopen 源码目录；可设置 PI_WORKSPACE_SRC");
}

const ENTRY_WINDOW_MS = 24 * 3_600_000;

export default async function (pi: ExtensionAPI) {
	const srcDir = resolveSrcDir();
	const load = async (name: string) => await import(pathToFileURL(join(srcDir, name)).href);
	const { workspacePaths } = await load("paths.js");
	const members = await load("members.js");
	const liveness = await load("liveness.js");
	const platform = await load("platform.js");
	const claims = await load("claims.js");
	const restore = await load("restore.js");
	const spawn = await load("spawn.js");
	const pane = await load("pane.js");
	const sessions = await load("sessions.js");
	const inuse = await load("inuse.js");
	const verify = await load("verify.js");
	const i18n = await load("i18n.js");
	const lang = i18n.resolveLang(process.env);
	const preflightMod = await load("preflight.js");
	const health = await load("health.js");
	const version = await load("version.js");
	const fs = await import("node:fs");
	const paths = workspacePaths();

	// 供 doctor 判断“扩展是否真的加载了”，以及 CLI/扩展版本是否一致。
	try {
		health.writeExtensionRecord({
			version: version.packageVersion(),
			schemaVersion: members.MEMBER_SCHEMA,
			platform: platform.runtimePlatform(process.env),
			distro: process.env.WSL_DISTRO_NAME,
			user: userInfo().username,
			pid: process.pid,
			ts: Date.now(),
			node: process.version,
		}, paths);
	} catch {
		/* 诊断信息写失败不应影响登记 */
	}

	let currentSessionId: string | undefined;
	let signalExit = false;
	const signals = ["SIGHUP", "SIGTERM"] as const;
	const markSignalExit = () => { signalExit = true; };
	function detachSignals(): void {
		for (const signal of signals) process.off(signal, markSignalExit);
	}

	// 测试钩子：仅在设置 PI_WORKSPACE_HOOKS 时生效，返回 runRestore 的注入参数
	async function loadHooks(): Promise<any> {
		const file = process.env.PI_WORKSPACE_HOOKS;
		if (!file) return {};
		try {
			const mod = await import(pathToFileURL(file).href);
			return typeof mod.default === "function" ? await mod.default() : mod;
		} catch {
			return {};
		}
	}

	pi.on("session_start", (_event: unknown, ctx: any) => {
		detachSignals();
		signalExit = false;
		if (ctx.mode === "tui") {
			for (const signal of signals) process.on(signal, markSignalExit);
		}
		register(ctx);
	});

	// 全新会话启动时文件尚未落盘；首条用户消息后补登记，此后每次发消息刷新时间戳
	pi.on("message_end", (event: any, ctx: any) => {
		if (event?.message?.role === "user") register(ctx);
	});

	function register(ctx: any): void {
		if (ctx.mode !== "tui") return;
		const sessionFile = ctx.sessionManager.getSessionFile();
		if (!sessionFile) return; // 仍未落盘的空窗口，不登记（恢复时跳过）
		currentSessionId = ctx.sessionManager.getSessionId();
		members.writeMember({
			sessionId: currentSessionId,
			cwd: ctx.cwd,
			sessionFile,
			name: ctx.sessionManager.getSessionName(),
			ts: Date.now(),
			pid: process.pid,
			processStart: liveness.processStart(process.pid),
			bootId: liveness.currentBootId(),
			// 共用 agent 目录时（例如 Windows 与 WSL）必须能识别记录来源，
			// 否则会用错误的平台/发行版去启动，开出一个必然失败的标签页。
			platform: platform.runtimePlatform(process.env),
			distro: process.env.WSL_DISTRO_NAME,
			user: userInfo().username,
		});
		claims.releaseClaim(currentSessionId, paths);
	}

	/**
	 * 关窗判定的第二道保险：Pi 在 SIGHUP/SIGTERM 之外也可能发出 quit。
	 * 此时若 WezTerm 里本 pane 已经消失，说明是窗口被关闭（被动死亡）而不是主动 /quit，
	 * 记录必须保留，否则该会话会从恢复集合里永久丢失。
	 * 返回 true 表示“按被动死亡处理，保留记录”。
	 */
	async function paneGone(): Promise<boolean> {
		const paneId = pane.currentPaneId(process.env);
		if (!paneId) return false;
		try {
			const hooks = await loadHooks();
			const probe = typeof hooks.paneExists === "function"
				? hooks.paneExists
				: (id: number) => pane.paneExists(id, { wezterm: process.env.PI_WORKSPACE_WEZTERM, env: process.env });
			const alive = await probe(paneId);
			// false 或无法判断（undefined）都保守地按“已消失”处理：宁可多恢复一次，不丢会话。
			return alive !== true;
		} catch {
			return true;
		}
	}

	pi.on("session_shutdown", async (event: any) => {
		// Pi also emits quit for SIGHUP/SIGTERM. Let all signal listeners run first.
		if (event.reason === "quit") await new Promise<void>((resolve) => setImmediate(resolve));
		try {
			if (!currentSessionId || event.reason === "reload") return;
			if (event.reason === "quit" && signalExit) return;
			if (event.reason === "quit" && (await paneGone())) return;
			if (["quit", "new", "resume", "fork"].includes(event.reason)) {
				members.deleteMember(currentSessionId, paths);
			}
		} finally {
			detachSignals();
			currentSessionId = undefined;
		}
	});

	async function restoreAndReport(ctx: any, dryRun = false): Promise<void> {
		const hooks = await loadHooks();
		// 与 CLI 一致：超过阈值先让用户确认，避免一键开出一屏标签页。
		const confirm = async ({ targets }: any) => ctx.ui.confirm(
			i18n.t(lang, "ext.confirmBulkTitle", { n: targets.length }),
			targets.map((item: any) => `${item.entry.name || item.entry.sessionId}  ${item.entry.cwd}`).join("\n"),
		);
		const result = await restore.runRestore({ dryRun, confirm, ...hooks });
		for (const line of restore.summarize(result, lang)) ctx.ui.notify(line, result.ok ? "info" : "warning");
	}

	async function openRecent(ctx: any): Promise<void> {
		const now = Date.now();
		const hooks = await loadHooks();
		const candidates: any[] = [];
		const seenFiles = new Set<string>();
		let missingCwd = 0;
		try {
			for (const dir of fs.readdirSync(paths.sessions)) {
				const p = join(paths.sessions, dir);
				let files: string[];
				try {
					files = fs.readdirSync(p).filter((f: string) => f.endsWith(".jsonl"));
				} catch {
					continue;
				}
				for (const file of files) {
					const full = join(p, file);
					try {
						const mtime = fs.statSync(full).mtimeMs;
						if (now - mtime > ENTRY_WINDOW_MS) continue;
						const meta = sessions.readSessionMeta(full);
						if (!meta?.sessionId || !meta.cwd) continue;
						const key = fs.realpathSync(full);
						if (seenFiles.has(key)) continue;
						seenFiles.add(key);
						if (!fs.existsSync(meta.cwd)) {
							missingCwd++;
							continue;
						}
						candidates.push({ sessionId: meta.sessionId, cwd: meta.cwd, sessionFile: full, ts: mtime, name: meta.name });
					} catch {
						/* 跳过损坏文件 */
					}
				}
			}
		} catch {
			/* 无会话目录 */
		}
		const live = new Set(members.listMembers(paths).filter((m: any) => liveness.isLive(m)).map((m: any) => m.sessionId));
		// 与 CLI 恢复一致：即使没有登记记录，也不能对已被其他进程打开的会话再开一个 Pi。
		const owners = hooks.owners ?? inuse.scanSessionOwners({ env: process.env });
		const own = currentSessionId;
		const todo = candidates
			.filter((c: any) => c.sessionId !== own && !live.has(c.sessionId)
				&& !owners.has(inuse.normalizeSessionPath(c.sessionFile)))
			.sort((a: any, b: any) => b.ts - a.ts);
		const skippedNote = missingCwd ? i18n.t(lang, "ext.recentSkippedCwd", { n: missingCwd }) : "";
		if (!todo.length) {
			ctx.ui.notify(i18n.t(lang, "ext.recentNone", { skipped: skippedNote }), "info");
			return;
		}
		const describe = (e: any) => `${new Date(e.ts).toLocaleString()} | ${basename(e.cwd)}${e.name ? ` · ${e.name}` : ""}`;
		const list = todo.map((e: any, i: number) => `${i + 1}. ${describe(e)} | ${e.cwd}`).join("\n");
		const input = await ctx.ui.input(i18n.t(lang, "ext.recentPrompt", { skipped: skippedNote, list }));
		if (!input?.trim()) return;
		const parts = input.trim().split(/[\s,，]+/);
		if (parts.some((p: string) => !/^\d+$/.test(p) || Number(p) < 1 || Number(p) > todo.length)) {
			ctx.ui.notify(i18n.t(lang, "ext.invalidIndex"), "warning");
			return;
		}
		const selected = [...new Set(parts.map(Number))].map((n: number) => todo[n - 1]);
		if (!(await ctx.ui.confirm(i18n.t(lang, "ext.confirmRecent"), selected.map(describe).join("\n")))) return;
		const pre = preflightMod.preflight();
		if (!pre.ok) {
			for (const line of restore.summarize({ ok: false, stage: "preflight", checks: pre.checks }, lang)) {
				ctx.ui.notify(line, "warning");
			}
			return;
		}
		// 与 CLI 恢复共用同一把全局锁：/reopen recent 不能与批量恢复叠加成标签页风暴。
		const lock = claims.acquireRestoreLock(paths, process.pid);
		if (lock.locked) {
			ctx.ui.notify(i18n.t(lang, "ext.locked"), "warning");
			return;
		}
		try {
			const baseline = Date.now();
			const requested: string[] = [];
			for (const entry of selected) {
				const claim = claims.claimSession(entry.sessionId, process.pid, paths);
				if (!claim.claimed) continue;
				const result = await spawn.openTab({
					wezterm: pre.wezterm,
					platform: pre.platform,
					piCommand: pre.piCommand,
					powershell: pre.powershell,
					distro: pre.distro,
					piBin: pre.piBin,
					cwd: entry.cwd,
					sessionFile: entry.sessionFile,
				});
				if (!result.ok) {
					claims.releaseClaim(entry.sessionId, paths);
					ctx.ui.notify(i18n.t(lang, "ext.spawnFailed", { cwd: entry.cwd, error: result.error }), "warning");
					continue;
				}
				await restore.setTitle({ wezterm: pre.wezterm, stdout: result.stdout, entry, env: process.env });
				// 占位记录：即使新 Pi 没能启动，下次恢复也能重试这个会话。
				// 已经有记录（新 Pi 已登记或此前残留）时不要覆盖，否则会把 pid 抹掉、
				// 让 waitForMembers 永远等不到确认。
				if (!members.readMember(entry.sessionId, paths)) {
					members.writeMember({
						...entry,
						pid: undefined,
						processStart: undefined,
						bootId: undefined,
						ts: Date.now(),
						platform: platform.runtimePlatform(process.env),
						distro: process.env.WSL_DISTRO_NAME,
						user: userInfo().username,
					});
				}
				requested.push(entry.sessionId);
			}
			// requirePid：占位记录不算确认，必须等真正的 Pi 进程登记。
			const verification = hooks.noWait || !requested.length
				? null
				: await verify.waitForMembers(requested, {
					paths,
					timeoutMs: hooks.waitTimeoutMs ?? 15_000,
					baseline,
					requirePid: true,
				});
			const unverified = verification?.unverified ?? [];
			for (const id of unverified) claims.releaseClaim(id, paths); // 未确认时允许立即重试
			if (!requested.length) {
				ctx.ui.notify(i18n.t(lang, "ext.noneOpened"), "warning");
			} else if (unverified.length) {
				ctx.ui.notify(i18n.t(lang, "ext.recentOpenedUnverified", { n: requested.length, m: unverified.length }), "warning");
			} else {
				ctx.ui.notify(i18n.t(lang, verification ? "ext.recentOpenedVerified" : "ext.recentOpened", { n: requested.length }), "info");
			}
		} finally {
			claims.releaseRestoreLock(paths, process.pid);
		}
	}

	async function runReopen(args: string, ctx: any): Promise<void> {
		const arg = (args ?? "").trim();
		if (arg === "clear") {
			const removed = members.clearWorkspace(paths);
			ctx.ui.notify(i18n.t(lang, "ext.clear", { n: removed }), "info");
			return;
		}
		if (arg === "recent") return openRecent(ctx);
		if (arg) {
			ctx.ui.notify(i18n.t(lang, "ext.reopenUsage"), "warning");
			return;
		}
		await restoreAndReport(ctx);
	}

	pi.registerCommand("reopen", {
		description: "恢复已登记的 pi 终端（/reopen recent 补选历史；/reopen clear 清空登记）",
		handler: (args: string, ctx: any) => runReopen(args, ctx),
	});

	// 过渡期别名：/all 已改名为 /reopen，行为不变
	pi.registerCommand("all", {
		description: "（已改名为 /reopen）恢复已登记的 pi 终端",
		handler: async (args: string, ctx: any) => {
			ctx.ui.notify(i18n.t(lang, "ext.aliasNotice"), "warning");
			await runReopen(args, ctx);
		},
	});

	pi.registerShortcut(Key.ctrlShift("o"), {
		description: "一键恢复上次所有 pi 终端",
		handler: async (ctx: any) => {
			await restoreAndReport(ctx);
		},
	});
}
