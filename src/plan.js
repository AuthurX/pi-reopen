import { existsSync, readdirSync, realpathSync, statSync } from "node:fs";
import { join } from "node:path";
import { normalizeSessionPath } from "./inuse.js";
import { isLive } from "./liveness.js";
import { workspacePaths } from "./paths.js";
import { runtimePlatform } from "./platform.js";

/** 由记录定位会话文件：优先记录内绝对路径，否则按 sessionId 扫描会话目录。 */
export function resolveSessionFile(entry, paths = workspacePaths()) {
	if (entry.sessionFile && existsSync(entry.sessionFile)) return entry.sessionFile;
	try {
		for (const dir of readdirSync(paths.sessions)) {
			const p = join(paths.sessions, dir);
			if (!statSync(p).isDirectory()) continue;
			const file = readdirSync(p).find((f) => f.endsWith(`_${entry.sessionId}.jsonl`));
			if (file) return join(p, file);
		}
	} catch {
		/* 无会话目录 */
	}
	return undefined;
}

function dedupeKey(sessionFile) {
	try {
		return realpathSync(sessionFile);
	} catch {
		return sessionFile;
	}
}

/**
 * 生成恢复计划。状态语义：
 * live        进程仍存活，跳过（也自然排除了发起恢复的当前会话）
 * claimed     其他恢复进程正在启动它，跳过
 * expired     记录早于 maxAgeMs（默认 14 天），不再自动恢复，可用 prune 清理
 * wrong-platform 记录来自其他系统/发行版（共用 agent 目录时），跳过并报告
 * missing-cwd 工作目录不存在，跳过并报告
 * missing-file 会话文件不存在（未落盘/已删除），跳过并报告
 * in-use      会话文件已被另一个 Pi 进程打开（即使没有登记），跳过以避免双写
 * duplicate   与更早条目指向同一会话文件（含别名），跳过
 * restorable  待恢复
 */
export function buildRestorePlan({
	members,
	paths = workspacePaths(),
	liveFn = isLive,
	claimFn,
	bootId,
	owners,
	platform = runtimePlatform(),
	distro = process.env.WSL_DISTRO_NAME,
	now = Date.now(),
	maxAgeMs,
}) {
	const seen = new Set();
	const items = [];
	const sorted = [...members].sort((a, b) => a.ts - b.ts);
	for (const entry of sorted) {
		let state = "restorable";
		let sessionFile;
		let detail;
		if (liveFn(entry, { bootId })) {
			state = "live";
		} else if (claimFn?.(entry.sessionId)) {
			state = "claimed";
		} else if (
			(entry.platform && entry.platform !== platform) ||
			(entry.platform === "wsl" && distro && entry.distro && entry.distro !== distro)
		) {
			state = "wrong-platform";
		} else if (!existsSync(entry.cwd)) {
			state = "missing-cwd";
		} else {
			sessionFile = resolveSessionFile(entry, paths);
			if (!sessionFile) {
				state = "missing-file";
			} else {
				const key = dedupeKey(sessionFile);
				if (seen.has(key)) {
					state = "duplicate";
				} else {
					seen.add(key);
					if (owners?.has(normalizeSessionPath(sessionFile))) {
						state = "in-use";
					} else if (Number.isFinite(maxAgeMs) && now - (entry.ts ?? 0) > maxAgeMs) {
						// 过期判定放在最后：缺文件/缺目录比“太久没动”更具体、更可操作。
						state = "expired";
					}
				}
			}
		}
		items.push({ entry, sessionFile, state });
	}
	return {
		items,
		restorable: items.filter((i) => i.state === "restorable"),
		count: (state) => items.filter((i) => i.state === state).length,
	};
}
