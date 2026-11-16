import { normalizeSessionPath } from "../../src/inuse.js";

/**
 * /reopen recent 测试钩子：模拟“会话已被其他 Pi 打开”和等待确认的超时。
 * 只影响 recent 路径，不影响 CLI restore。
 */
export default () => {
	const owners = new Map();
	const inUse = process.env.PI_WORKSPACE_RECENT_INUSE;
	if (inUse) owners.set(normalizeSessionPath(inUse), 4242);
	return {
		owners,
		noWait: process.env.PI_WORKSPACE_RECENT_NOWAIT === "1",
		waitTimeoutMs: Number(process.env.PI_WORKSPACE_RECENT_WAIT ?? 200),
	};
};
