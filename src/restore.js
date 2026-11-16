import { acquireRestoreLock, activeClaim, claimSession, releaseRestoreLock, sweepClaims } from "./claims.js";
import { listMembers } from "./members.js";
import { buildRestorePlan } from "./plan.js";
import { preflight } from "./preflight.js";
import { openTab } from "./spawn.js";
import { workspacePaths } from "./paths.js";
import { basename } from "node:path";
import { scanSessionOwners } from "./inuse.js";
import { maxAgeMsFromEnv } from "./prune.js";
import { parsePaneId, setTabTitle } from "./pane.js";
import { runtimePlatform } from "./platform.js";
import { currentBootId } from "./liveness.js";
import { waitForMembers } from "./verify.js";
import { resolveLang, t } from "./i18n.js";

export function label(state, lang = resolveLang()) {
	const key = `state.${state}`;
	const text = t(lang, key);
	return text === key ? state : text;
}

/** 标签页标题：优先会话名，否则工作目录的文件夹名（需求 13）。 */
export function tabTitle(entry) {
	return entry?.name || (entry?.cwd ? basename(entry.cwd) : entry?.sessionId);
}

/** 只读：列出全部成员与状态（list / dry-run 共用）。 */
export function inspect({ paths = workspacePaths(), owners, env = process.env, platform, distro, now, maxAgeMs, only } = {}) {
	const members = listMembers(paths);
	const plan = buildRestorePlan({
		members,
		paths,
		claimFn: (sessionId) => !!activeClaim(sessionId, paths),
		bootId: currentBootId(),
		owners: owners ?? scanSessionOwners({ env }),
		platform: platform ?? runtimePlatform(env),
		distro: distro ?? env.WSL_DISTRO_NAME,
		now,
		maxAgeMs: maxAgeMs ?? maxAgeMsFromEnv(env),
		only,
	});
	return { members, plan };
}

/** 开完标签页后设置标题；失败只影响外观，不影响恢复结果。 */
export async function setTitle({ wezterm, stdout, entry, env = process.env, titleSetter = setTabTitle } = {}) {
	const paneId = parsePaneId(stdout);
	const title = tabTitle(entry);
	if (!paneId || !title) return false;
	try {
		return await titleSetter({ wezterm, paneId, title, env });
	} catch {
		return false;
	}
}

/** 连续请求失败达此值时提前停止（WezTerm 多半已卡死，继续只会堆积更多超时等待）。 */
const MAX_CONSECUTIVE_FAILURES = 3;

/** 批量恢复默认超过这个数量就先确认，避免无提示地开出一屏标签页。 */
export const CONFIRM_THRESHOLD = 5;

/**
 * 默认确认等待窗口：按批大小放大。
 * 固定 15s 对 20+ 个 WSL 会话不够，会让大量正常启动被误报成“超时未确认”。
 */
export function defaultWaitTimeoutMs(count) {
	return Math.min(90_000, 15_000 + 2_000 * Math.max(0, count));
}

/**
 * 恢复编排：预检 → 计划 → 全局恢复锁 → 声明启动占用 → 逐个发开标签页请求 → 等待登记确认。
 * 结果如实区分：requested（WezTerm 接受请求）与 verified（Pi 已启动并登记）。
 */
export async function runRestore({
	env = process.env,
	platform,
	paths = workspacePaths(env),
	dryRun = false,
	noWait = false,
	waitTimeoutMs,
	spawnTimeoutMs,
	limit,
	delayMs = 0,
	confirm,
	confirmThreshold = CONFIRM_THRESHOLD,
	sleeper = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
	spawner,
	prober,
	piProber,
	owners,
	titleSetter,
	only,
} = {}) {
	const pre = preflight({ env, platform, prober, piProber });
	if (!pre.ok) {
		return { ok: false, stage: "preflight", checks: pre.checks };
	}
	sweepClaims(paths);
	const { plan } = inspect({ paths, owners, env, platform: pre.platform, distro: pre.distro, only });
	if (dryRun) {
		return { ok: true, stage: "dry-run", plan };
	}
	const restorable = plan.restorable;
	const targets = Number.isFinite(limit) && limit > 0 ? restorable.slice(0, limit) : restorable;
	const deferred = restorable.slice(targets.length);
	// 超出 --limit 的条目在计划里也改成 deferred，避免汇总里仍显示“待恢复”。
	for (const item of deferred) item.state = "deferred";
	if (confirm && targets.length > confirmThreshold && !(await confirm({ plan, targets }))) {
		return { ok: false, stage: "cancelled", plan };
	}
	const lock = acquireRestoreLock(paths, process.pid);
	if (lock.locked) {
		return { ok: false, stage: "locked", holder: lock.holder, plan };
	}
	try {
		const baseline = Date.now();
		// 计划阶段就已被其他恢复进程占用的条目也要如实出现在结果里，
		// 否则“全部被占用”会被误报成“没有待恢复的会话”。
		const results = plan.items.filter((item) => item.state === "claimed" || item.state === "deferred");
		let consecutiveFailures = 0;
		let aborted = false;
		for (const [index, item] of targets.entries()) {
			if (index > 0 && delayMs > 0) await sleeper(delayMs);
			if (aborted) {
				results.push({ ...item, requested: false, aborted: true });
				continue;
			}
			const claim = claimSession(item.entry.sessionId, process.pid, paths);
			if (!claim.claimed) {
				results.push({ ...item, state: "claimed" });
				continue;
			}
			const spawnResult = await openTab({
				wezterm: pre.wezterm,
				platform: pre.platform,
				piCommand: pre.piCommand,
				powershell: pre.powershell,
				distro: pre.distro,
				piBin: pre.piBin,
				env,
				cwd: item.entry.cwd,
				sessionFile: item.sessionFile,
				spawner,
				spawnTimeoutMs,
			});
			if (spawnResult.ok) {
				consecutiveFailures = 0;
				results.push({ ...item, requested: true });
				await setTitle({ wezterm: pre.wezterm, stdout: spawnResult.stdout, entry: item.entry, env, titleSetter });
			} else {
				consecutiveFailures++;
				results.push({ ...item, requested: false, requestError: spawnResult.error });
			}
			if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) aborted = true;
		}
		const requestedIds = results.filter((r) => r.requested).map((r) => r.entry.sessionId);
		const verification = noWait || requestedIds.length === 0
			? null
			: await waitForMembers(requestedIds, {
				paths,
				timeoutMs: waitTimeoutMs ?? defaultWaitTimeoutMs(requestedIds.length),
				baseline,
			});
		const ok = results.every((r) => r.requested);
		return { ok, stage: "done", plan, results, aborted, verification };
	} finally {
		releaseRestoreLock(paths, process.pid);
	}
}

/**
 * 进程退出码契约（脚本化依赖它，不要随意改变含义）：
 *   0 全部请求成功且已确认（或无待恢复项）
 *   1 至少一个 WezTerm 请求失败 / 用法错误
 *   2 环境预检未通过
 *   3 请求已发出，但超时未确认 Pi 启动
 *   4 有项目被跳过（被其他恢复进程占用、提前中止），但没有失败
 * 优先级：失败 > 未确认 > 跳过 > 成功。
 */
export const EXIT = Object.freeze({ ok: 0, failed: 1, preflight: 2, unverified: 3, skipped: 4 });

export function exitCodeFor(result) {
	if (result.stage === "preflight") return EXIT.preflight;
	if (result.stage === "locked") return EXIT.skipped;
	if (result.stage === "dry-run") return EXIT.ok;
	if (result.stage === "cancelled") return EXIT.ok; // 用户主动取消不算失败
	const results = result.results ?? [];
	const skippedStates = new Set(["claimed", "deferred"]);
	if (results.some((item) => !skippedStates.has(item.state) && !item.aborted && !item.requested)) return EXIT.failed;
	if (result.verification?.unverified?.length) return EXIT.unverified;
	if (results.some((item) => skippedStates.has(item.state) || item.aborted)) return EXIT.skipped;
	return EXIT.ok;
}

/** 生成给人看的报告行（按 lang 本地化）。 */
export function summarize(result, lang = resolveLang()) {
	const lines = [];
	if (result.stage === "preflight") {
		lines.push(t(lang, "restore.preflightHeader"));
		for (const check of result.checks.filter((c) => !c.ok)) {
			lines.push(t(lang, "restore.check", { name: check.name, detail: check.detail }));
			if (check.hint) lines.push(t(lang, "restore.hint", { hint: check.hint }));
		}
		return lines;
	}
	if (result.stage === "cancelled") {
		lines.push(t(lang, "restore.cancelled"));
		return lines;
	}
	if (result.stage === "locked") {
		lines.push(t(lang, "restore.lockedHeader"));
		lines.push(t(lang, "restore.lockedHolder", {
			pid: result.holder?.pid ?? "?",
			ts: new Date(result.holder?.ts ?? Date.now()).toLocaleString(),
		}));
		return lines;
	}
	const counts = {};
	for (const item of result.plan.items) counts[item.state] = (counts[item.state] ?? 0) + 1;
	const skippedList = Object.entries(counts)
		.filter(([state]) => state !== "restorable")
		.map(([state, n]) => t(lang, "restore.skippedItem", { label: label(state, lang), n }))
		.join(" · ");
	const skippedText = skippedList ? t(lang, "restore.skipped", { list: skippedList }) : "";
	if (result.stage === "dry-run") {
		lines.push(t(lang, "restore.dryRunHeader", { n: result.plan.restorable.length, skipped: skippedText }));
		for (const item of result.plan.restorable) {
			lines.push(t(lang, "restore.dryRunItem", { title: item.entry.name || item.entry.sessionId, cwd: item.entry.cwd }));
		}
		return lines;
	}
	for (const r of result.results) {
		const title = r.entry.name || r.entry.sessionId;
		if (r.state === "claimed") {
			lines.push(t(lang, "restore.claimedItem", { title }));
		} else if (r.state === "deferred") {
			lines.push(t(lang, "restore.deferredItem", { title }));
		} else if (r.aborted) {
			lines.push(t(lang, "restore.abortedItem", { title }));
		} else if (!r.requested) {
			lines.push(t(lang, "restore.failedItem", { title, error: r.requestError }));
		} else if (result.verification?.verified.includes(r.entry.sessionId)) {
			lines.push(t(lang, "restore.verifiedItem", { title, cwd: r.entry.cwd }));
		} else {
			lines.push(t(lang, "restore.unverifiedItem", { title, cwd: r.entry.cwd }));
		}
	}
	const processed = result.results.filter((r) => r.requested || r.requestError !== undefined || r.aborted).length;
	if (!processed) {
		lines.push(t(lang, "restore.none", { skipped: skippedText }));
	} else {
		lines.push(t(lang, "restore.processed", {
			n: processed,
			skipped: skippedText,
			aborted: result.aborted ? t(lang, "restore.abortedSuffix") : "",
		}));
	}
	return lines;
}
