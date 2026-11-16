import { readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { join } from "node:path";
import { binfmtStatus, persistHint } from "./binfmt.js";
import { resolveLang, t } from "./i18n.js";
import { workspacePaths } from "./paths.js";
import { currentBootId, isLive } from "./liveness.js";
import { clearWorkspace } from "./members.js";
import { forgetMembers, maxAgeMsFromEnv, pruneMembers, resolveMemberIds } from "./prune.js";
import { exitCodeFor, inspect, label, runRestore, summarize } from "./restore.js";
import { preflight } from "./preflight.js";
import { runtimePlatform } from "./platform.js";
import { packageVersion } from "./version.js";

/** 单字符显示宽度：CJK/全角记 2，其余记 1（东亚宽度简化表）。 */
function charWidth(cp) {
	if (
		(cp >= 0x1100 && cp <= 0x115f) || (cp >= 0x2e80 && cp <= 0x303e) ||
		(cp >= 0x3041 && cp <= 0x33ff) || (cp >= 0x3400 && cp <= 0x4dbf) ||
		(cp >= 0x4e00 && cp <= 0x9fff) || (cp >= 0xa000 && cp <= 0xa4cf) ||
		(cp >= 0xac00 && cp <= 0xd7a3) || (cp >= 0xf900 && cp <= 0xfaff) ||
		(cp >= 0xfe30 && cp <= 0xfe4f) || (cp >= 0xff00 && cp <= 0xff60) ||
		(cp >= 0xffe0 && cp <= 0xffe6) || (cp >= 0x1f300 && cp <= 0x1faff) ||
		(cp >= 0x20000 && cp <= 0x2fffd) || (cp >= 0x30000 && cp <= 0x3fffd)
	) return 2;
	return 1;
}

/** 把“裸 flag”归一化为 restore：pi-reopen --dry-run 等同于 restore --dry-run。 */
export function normalizeArgv(argv = []) {
	const [first, ...rest] = argv;
	if (first === "help" || first === "--help" || first === "-h") return { command: "help", flags: rest };
	if (first === "version" || first === "--version" || first === "-v") return { command: "version", flags: rest };
	if (!first || first.startsWith("-")) return { command: "restore", flags: argv };
	return { command: first, flags: rest };
}

/** 收集 --only 模式（支持 --only a,b 与 --only=a）。 */
export function collectOnly(flags = []) {
	const patterns = [];
	for (let i = 0; i < flags.length; i++) {
		const flag = flags[i];
		if (flag === "--only") {
			const value = flags[i + 1];
			if (value && !value.startsWith("-")) patterns.push(...value.split(","));
		} else if (flag.startsWith("--only=")) {
			patterns.push(...flag.slice("--only=".length).split(","));
		}
	}
	return patterns.map((p) => p.trim()).filter(Boolean);
}

function flagValue(flags, name) {
	for (let i = 0; i < flags.length; i++) {
		if (flags[i] === name && i + 1 < flags.length) return flags[i + 1];
		if (flags[i].startsWith(`${name}=`)) return flags[i].slice(name.length + 1);
	}
	return undefined;
}

/** restore 的机器可读输出。 */
export function jsonPayload(result, code) {
	const items = (result.plan?.items ?? []).map((item) => ({
		sessionId: item.entry.sessionId,
		name: item.entry.name,
		cwd: item.entry.cwd,
		state: item.state,
	}));
	const results = (result.results ?? []).map((item) => ({
		sessionId: item.entry.sessionId,
		name: item.entry.name,
		cwd: item.entry.cwd,
		state: item.state,
		requested: !!item.requested,
		error: item.requestError,
	}));
	const verified = new Set(result.verification?.verified ?? []);
	for (const item of results) {
		if (item.requested) item.verified = verified.has(item.sessionId);
	}
	return {
		stage: result.stage,
		ok: !!result.ok,
		exitCode: code,
		checks: result.checks,
		plan: result.plan ? { items } : undefined,
		results,
		verification: result.verification,
	};
}

export function displayWidth(str) {
	let w = 0;
	for (const ch of str) w += charWidth(ch.codePointAt(0));
	return w;
}

function padTo(str, width) {
	const gap = width - displayWidth(str);
	return gap > 0 ? `${str}${" ".repeat(gap)}` : str;
}

/** 按显示宽度截断，超出尾部加省略号。 */
function truncateTo(str, width) {
	if (displayWidth(str) <= width) return str;
	if (width <= 1) return "…";
	let out = "";
	let w = 0;
	for (const ch of str) {
		const cw = charWidth(ch.codePointAt(0));
		if (w + cw > width - 1) break;
		out += ch;
		w += cw;
	}
	return `${out}…`;
}

const SEP = " | ";

/** 对齐表格：状态/会话/路径/时间；超宽时截断会话名/路径；终端过窄放不下表格时退回未对齐的简单行。 */
function listLines({ plan }, { termWidth = 80, lang = resolveLang() } = {}) {
	if (!plan.items.length) return [t(lang, "cli.listEmpty")];
	const rows = plan.items.map((item) => [
		label(item.state, lang),
		item.entry.name || item.entry.sessionId,
		item.entry.cwd ?? "",
		new Date(item.entry.ts).toLocaleString(),
	]);
	const stateW = Math.max(8, ...rows.map((r) => displayWidth(r[0])));
	const whenW = Math.max(4, ...rows.map((r) => displayWidth(r[3])));
	let titleW = Math.max(1, ...rows.map((r) => displayWidth(r[1])));
	let cwdW = Math.max(1, ...rows.map((r) => displayWidth(r[2])));
	const avail = termWidth - stateW - whenW - SEP.length * 3;
	if (Number.isFinite(avail) && avail < 8) return rows.map((r) => r.join(SEP));
	if (Number.isFinite(avail) && titleW + cwdW > avail) {
		const total = titleW + cwdW;
		titleW = Math.min(Math.max(4, Math.floor((avail * titleW) / total)), avail - 4);
		cwdW = avail - titleW;
	}
	const widths = [stateW, titleW, cwdW, whenW];
	const render = (cells) => cells.map((c, i) => padTo(truncateTo(c, widths[i]), widths[i])).join(SEP);
	return [render([t(lang, "cli.listState"), t(lang, "cli.listSession"), t(lang, "cli.listPath"), t(lang, "cli.listTime")]), ...rows.map(render)];
}

/** 交互确认；非 TTY（管道、CI）不阻塞，保持可脚本化。 */
export async function promptYesNo(question, { input = process.stdin, output = process.stdout } = {}) {
	if (!input?.isTTY) return true;
	const rl = createInterface({ input, output });
	try {
		const answer = (await rl.question(question)).trim().toLowerCase();
		return answer === "y" || answer === "yes" || answer === "是";
	} finally {
		rl.close();
	}
}

export async function run(argv = [], { stdout = process.stdout, env = process.env, stdin = process.stdin, confirm: confirmOverride } = {}) {
	const { command, flags } = normalizeArgv(argv);
	const lang = resolveLang(env);
	const hasFlag = (name) => flags.includes(name);
	const write = (line) => {
		try {
			stdout.write(`${line}\n`);
		} catch (err) {
			if (err?.code !== "EPIPE") throw err;
			process.exit(0); // 管道提前关闭（如 | head），正常退出
		}
	};
	stdout.on?.("error", (err) => {
		if (err?.code === "EPIPE") process.exit(0); // 管道提前关闭（如 | head），正常退出
		throw err;
	});

	switch (command) {
		case "help": {
			write(t(lang, "cli.usage"));
			return 0;
		}
		case "version": {
			write(t(lang, "cli.version", { version: packageVersion() }));
			return 0;
		}
		case "restore": {
			const limitRaw = Number(flagValue(flags, "--limit"));
			const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.floor(limitRaw) : undefined;
			const delayRaw = Number(flagValue(flags, "--delay"));
			const delayMs = Number.isFinite(delayRaw) && delayRaw > 0 ? delayRaw : 0;
			const thresholdRaw = Number(env.PI_WORKSPACE_CONFIRM_THRESHOLD);
			const yes = hasFlag("--yes") || hasFlag("-y");
			const confirm = yes || hasFlag("--dry-run") || hasFlag("--json")
				? undefined
				: confirmOverride ?? (async ({ targets }) => {
					const list = targets
						.map((item) => `  ${item.entry.name || item.entry.sessionId}  ${item.entry.cwd}`)
						.join("\n");
					return promptYesNo(`${t(lang, "cli.confirmBulk", { n: targets.length })}\n${list}\n[y/N] `, { input: stdin, output: stdout });
				});
			const result = await runRestore({
				env,
				dryRun: hasFlag("--dry-run"),
				noWait: hasFlag("--no-wait"),
				only: collectOnly(flags),
				limit,
				delayMs,
				confirm,
				confirmThreshold: Number.isFinite(thresholdRaw) && thresholdRaw >= 0 ? thresholdRaw : undefined,
			});
			const code = exitCodeFor(result);
			if (hasFlag("--json")) {
				write(JSON.stringify(jsonPayload(result, code), null, 2));
			} else {
				for (const line of summarize(result)) write(line);
			}
			return code;
		}
		case "list": {
			const wide = hasFlag("--wide");
			const inspected = inspect({ paths: workspacePaths(env), env });
			if (hasFlag("--json")) {
				write(JSON.stringify({
					members: inspected.plan.items.map((item) => ({
						sessionId: item.entry.sessionId,
						name: item.entry.name,
						cwd: item.entry.cwd,
						ts: item.entry.ts,
						state: item.state,
					})),
				}, null, 2));
				return 0;
			}
			let columns = Number(stdout?.columns);
			if (!Number.isFinite(columns) || columns <= 0) columns = Number(env.COLUMNS);
			if (!Number.isFinite(columns) || columns <= 0) columns = 80;
			const lines = listLines(inspected, {
				termWidth: wide ? Number.POSITIVE_INFINITY : columns,
				lang,
			});
			for (const line of lines) write(line);
			return 0;
		}
		case "doctor": {
			const pre = preflight({ env, lang });
			for (const check of pre.checks) {
				write(t(lang, "cli.doctorCheck", { mark: check.ok ? "✔" : "✖", name: check.name, detail: check.detail }));
				if (check.hint) write(t(lang, "restore.hint", { hint: check.hint }));
			}
			const binfmt = runtimePlatform(env) === "wsl" ? binfmtStatus() : {};
			if (binfmt.registered && !binfmt.persistent) {
				write(t(lang, "cli.binfmtWarning"));
				for (const line of persistHint(lang).split("\n")) write(`  ${line}`);
			}
			write(pre.ok ? t(lang, "cli.doctorReady") : t(lang, "cli.doctorBlocked"));
			return pre.ok ? 0 : 2;
		}
		case "forget": {
			const targets = flags.filter((flag) => !flag.startsWith("-"));
			if (!targets.length) {
				write(t(lang, "cli.forgetUsage"));
				return 1;
			}
			const paths = workspacePaths(env);
			const { ids, missing, ambiguous } = resolveMemberIds(targets, paths);
			for (const item of ambiguous) {
				write(t(lang, "cli.forgetAmbiguous", { input: item.input, candidates: item.candidates.join(", ") }));
			}
			if (ambiguous.length) return 1;
			const removed = forgetMembers(ids, paths);
			write(t(lang, "cli.forgetRemoved", {
				n: removed,
				missing: missing.length ? t(lang, "cli.forgetMissing", { list: missing.join(", ") }) : "",
			}));
			return missing.length && !removed ? 1 : 0;
		}
		case "prune": {
			const dryRun = hasFlag("--dry-run");
			const result = pruneMembers({
				paths: workspacePaths(env),
				dryRun,
				now: Date.now(),
				maxAgeMs: maxAgeMsFromEnv(env),
				platform: runtimePlatform(env),
				distro: env.WSL_DISTRO_NAME,
			});
			for (const entry of result.removed) {
				write(t(lang, "cli.pruneItem", { title: entry.name || entry.sessionId, cwd: entry.cwd ?? "" }));
			}
			write(t(lang, dryRun ? "cli.pruneDryRun" : "cli.pruneDone", {
				n: result.removed.length,
				kept: result.kept ? t(lang, "cli.pruneKept", { n: result.kept }) : "",
			}));
			return 0;
		}
		case "clear": {
			const removed = clearWorkspace(workspacePaths(env));
			write(t(lang, "cli.clear", { n: removed }));
			return 0;
		}
		default:
			write(t(lang, "cli.usage"));
			return 1;
	}
}
