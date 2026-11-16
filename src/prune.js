import { releaseClaim, activeClaim } from "./claims.js";
import { currentBootId } from "./liveness.js";
import { deleteMember, listMembers } from "./members.js";
import { workspacePaths } from "./paths.js";
import { buildRestorePlan } from "./plan.js";
import { runtimePlatform } from "./platform.js";

/** 默认过期时间：超过这个天数的被动死亡记录不再自动恢复（用户可显式 prune）。 */
export const DEFAULT_MAX_AGE_DAYS = 14;

export function maxAgeMsFromEnv(env = process.env) {
	const raw = env.PI_WORKSPACE_MAX_AGE_DAYS;
	if (raw === undefined || raw === "") return DEFAULT_MAX_AGE_DAYS * 86_400_000;
	const days = Number(raw);
	if (!Number.isFinite(days) || days < 0) return DEFAULT_MAX_AGE_DAYS * 86_400_000;
	return days === 0 ? Number.POSITIVE_INFINITY : days * 86_400_000;
}

/** 删除单条登记（成员 + 启动声明），不影响对话文件。 */
export function forgetMembers(sessionIds, paths = workspacePaths()) {
	let removed = 0;
	for (const sessionId of sessionIds) {
		removed++;
		deleteMember(sessionId, paths);
		releaseClaim(sessionId, paths);
	}
	return removed;
}

/** 按完整 id 或唯一前缀解析用户输入；返回可删除项、未找到项与有歧义项。 */
export function resolveMemberIds(inputs, paths = workspacePaths()) {
	const members = listMembers(paths);
	const ids = new Set();
	const missing = [];
	const ambiguous = [];
	for (const input of inputs) {
		const exact = members.filter((m) => m.sessionId === input);
		const matches = exact.length ? exact : members.filter((m) => String(m.sessionId).startsWith(input));
		if (!matches.length) {
			missing.push(input);
		} else if (matches.length > 1) {
			ambiguous.push({ input, candidates: matches.map((m) => m.sessionId) });
		} else {
			ids.add(matches[0].sessionId);
		}
	}
	return { ids: [...ids], missing, ambiguous };
}

/**
 * 清理无法恢复或已经过期的记录。可删除状态：
 * - expired       超过 maxAgeMs
 * - missing-cwd   工作目录不存在
 * - missing-file  会话文件不存在（按记录路径与会话目录扫描都找不到）
 * 存活、被其他恢复进程占用、已被其他窗口打开、属于其他平台/发行版的记录一律保留。
 */
export function pruneMembers({
	paths = workspacePaths(),
	now = Date.now(),
	maxAgeMs = maxAgeMsFromEnv(),
	dryRun = false,
	platform = runtimePlatform(),
	distro = process.env.WSL_DISTRO_NAME,
	owners,
} = {}) {
	const members = listMembers(paths);
	const plan = buildRestorePlan({
		members,
		paths,
		claimFn: (sessionId) => !!activeClaim(sessionId, paths),
		bootId: currentBootId(),
		platform,
		distro,
		owners,
		now,
		maxAgeMs,
	});
	const removableStates = new Set(["expired", "missing-cwd", "missing-file"]);
	const removable = plan.items.filter((item) => removableStates.has(item.state));
	if (!dryRun) {
		for (const item of removable) {
			deleteMember(item.entry.sessionId, paths);
			releaseClaim(item.entry.sessionId, paths);
		}
	}
	return { removed: removable.map((item) => item.entry), kept: members.length - removable.length };
}
