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

const STATE_LABEL = {
	live: "运行中",
	claimed: "启动占用中",
	expired: "已过期",
	filtered: "未匹配 --only",
	"wrong-platform": "其他平台/发行版",
	"missing-cwd": "工作目录缺失",
	"missing-file": "会话文件缺失",
	"in-use": "已在其他窗口打开",
	duplicate: "重复条目",
	restorable: "待恢复",
};

export function label(state) {
	return STATE_LABEL[state] ?? state;
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
	waitTimeoutMs = 15_000,
	spawnTimeoutMs,
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
	const lock = acquireRestoreLock(paths, process.pid);
	if (lock.locked) {
		return { ok: false, stage: "locked", holder: lock.holder, plan };
	}
	try {
		const baseline = Date.now();
		// 计划阶段就已被其他恢复进程占用的条目也要如实出现在结果里，
		// 否则“全部被占用”会被误报成“没有待恢复的会话”。
		const results = plan.items.filter((item) => item.state === "claimed");
		let consecutiveFailures = 0;
		let aborted = false;
		for (const item of plan.restorable) {
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
			: await waitForMembers(requestedIds, { paths, timeoutMs: waitTimeoutMs, baseline });
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
	const results = result.results ?? [];
	if (results.some((item) => item.state !== "claimed" && !item.aborted && !item.requested)) return EXIT.failed;
	if (result.verification?.unverified?.length) return EXIT.unverified;
	if (results.some((item) => item.state === "claimed" || item.aborted)) return EXIT.skipped;
	return EXIT.ok;
}

/** 生成给人看的中文报告行。 */
export function summarize(result) {
	const lines = [];
	if (result.stage === "preflight") {
		lines.push("环境预检未通过，未打开任何标签页：");
		for (const check of result.checks.filter((c) => !c.ok)) {
			lines.push(`  ✖ ${check.name}：${check.detail}`);
			if (check.hint) lines.push(`    → ${check.hint}`);
		}
		return lines;
	}
	if (result.stage === "locked") {
		lines.push("✖ 另一个恢复进程正在进行，本次未打开任何标签页：");
		lines.push(`  → 持有者 pid ${result.holder?.pid}，开始于 ${new Date(result.holder?.ts).toLocaleString()}`);
		return lines;
	}
	const counts = {};
	for (const item of result.plan.items) counts[item.state] = (counts[item.state] ?? 0) + 1;
	const skipped = Object.entries(counts)
		.filter(([state]) => state !== "restorable")
		.map(([state, n]) => `${label(state)} ${n}`)
		.join(" · ");
	if (result.stage === "dry-run") {
		lines.push(`[dry-run] 待恢复 ${result.plan.restorable.length} 个${skipped ? `；跳过：${skipped}` : ""}`);
		for (const item of result.plan.restorable) {
			lines.push(`  → ${item.entry.name || item.entry.sessionId} | ${item.entry.cwd}`);
		}
		return lines;
	}
	for (const r of result.results) {
		const title = r.entry.name || r.entry.sessionId;
		if (r.state === "claimed") {
			lines.push(`  ⏭ ${title}：其他恢复进程正在启动，跳过`);
		} else if (r.aborted) {
			lines.push(`  ⏭ ${title}：未尝试（WezTerm 请求连续失败，提前停止）`);
		} else if (!r.requested) {
			lines.push(`  ✖ ${title}：WezTerm 请求失败 — ${r.requestError}`);
		} else if (result.verification?.verified.includes(r.entry.sessionId)) {
			lines.push(`  ✔ ${title}：已启动并确认（${r.entry.cwd}）`);
		} else {
			lines.push(`  ⚠ ${title}：已创建标签页，超时未确认 pi 启动（${r.entry.cwd}）`);
		}
	}
	const skippedText = skipped ? `；跳过：${skipped}` : "";
	const processed = result.results.filter((r) => r.requested || r.requestError !== undefined || r.aborted).length;
	if (!processed) {
		lines.push(`没有待恢复的会话${skippedText}`);
	} else {
		lines.push(`已处理 ${processed} 个${skippedText}${result.aborted ? "（已提前停止）" : ""}`);
	}
	return lines;
}
