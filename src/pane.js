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

/** wezterm cli spawn 的 stdout 是新 pane 的数字 id。 */
export function parsePaneId(stdout) {
	const match = /(\d+)/.exec(String(stdout ?? "").trim());
	return match ? Number(match[1]) : undefined;
}

/** 标题单行化并限长，避免控制字符或超长标题污染标签栏。 */
export function sanitizeTitle(title, maxLength = 60) {
	const flat = String(title ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
	if (!flat) return undefined;
	return [...flat].slice(0, maxLength).join("");
}

/** 设置标签页标题；失败不影响恢复结果（标题只是装饰）。 */
export function setTabTitle({ wezterm, paneId, title, env = process.env, runner, timeoutMs = PANE_QUERY_TIMEOUT_MS } = {}) {
	const clean = sanitizeTitle(title);
	if (!Number.isSafeInteger(paneId) || paneId <= 0 || !clean) return false;
	const run = runner ?? ((program, args) =>
		spawnSync(program, args, { env, encoding: "utf8", timeout: timeoutMs, windowsHide: true }));
	try {
		return run(wezterm || "wezterm", ["cli", "set-tab-title", "--pane-id", String(paneId), clean])?.status === 0;
	} catch {
		return false;
	}
}
