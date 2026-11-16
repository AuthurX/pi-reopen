import { spawnSync } from "node:child_process";

export const PANE_QUERY_TIMEOUT_MS = 5_000;

/** WezTerm 向 pane 内的进程注入 WEZTERM_PANE；不在 WezTerm 内运行时为 undefined。 */
export function currentPaneId(env = process.env) {
	const id = Number(env.WEZTERM_PANE);
	return Number.isSafeInteger(id) && id > 0 ? id : undefined;
}

/**
 * 判断本 pane 是否仍存在于 WezTerm 的 mux 中：
 * - true   pane 还在 → 用户是在活着的终端里主动 /quit
 * - false  pane 已消失 → 窗口被关闭/崩溃，属于被动死亡
 * - undefined 无法判断（WezTerm 不可达、输出不可解析）
 */
export function paneExists(paneId, { wezterm, env = process.env, runner, timeoutMs = PANE_QUERY_TIMEOUT_MS } = {}) {
	if (!Number.isSafeInteger(paneId) || paneId <= 0) return undefined;
	const run = runner ?? ((program, args) =>
		spawnSync(program, args, { env, encoding: "utf8", timeout: timeoutMs, windowsHide: true }));
	try {
		const out = run(wezterm || "wezterm", ["cli", "list", "--format", "json"]);
		if (out?.status !== 0) return undefined;
		const panes = JSON.parse(String(out.stdout ?? ""));
		if (!Array.isArray(panes)) return undefined;
		return panes.some((pane) => Number(pane?.pane_id) === paneId);
	} catch {
		return undefined;
	}
}
