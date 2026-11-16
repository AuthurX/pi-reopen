import { readMember } from "./members.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 等待被恢复的 Pi 完成登记（成员记录被新进程以不早于 baseline 的时间戳覆盖）。
 * 用 >= 而不是 >：同一毫秒内完成的登记不能被误判为超时。
 * 只确认“pi 已启动并登记”，超时未确认的如实报告为未确认。
 */
export async function waitForMembers(sessionIds, { paths, timeoutMs = 15_000, pollMs = 500, baseline = Date.now(), sleeper = sleep, requirePid = false } = {}) {
	const pending = new Set(sessionIds);
	const verified = new Set();
	const deadline = Date.now() + timeoutMs;
	for (;;) {
		for (const id of [...pending]) {
			const member = readMember(id, paths);
			// requirePid：只有真正的 Pi 进程登记（带 pid）才算确认，
			// 排除调用方自己写下的占位记录。
			if (member && member.ts >= baseline && (!requirePid || member.pid)) {
				verified.add(id);
				pending.delete(id);
			}
		}
		if (!pending.size) break;
		const remaining = deadline - Date.now();
		if (remaining <= 0) break;
		// 短超时下也要在最后一次等待后重新检查，不能因为 pollMs 大于超时而漏掉登记。
		await sleeper(Math.min(pollMs, remaining));
	}
	return { verified: [...verified], unverified: [...pending] };
}
