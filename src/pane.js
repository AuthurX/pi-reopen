import { getTerminal, terminalId } from "./terminals/index.js";

/** 终端输出里新 pane 的数字 id。 */
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

/** 当前 pane id（适配器各自实现：WezTerm 读 WEZTERM_PANE）。 */
export function currentPaneId(env = process.env, terminal = terminalId(env)) {
	return getTerminal(terminal)?.currentPaneId(env);
}

/** 设置标签页标题；失败不影响恢复结果。 */
export function setTabTitle({ terminal = terminalId(), wezterm, program, paneId, title, env = process.env, runner } = {}) {
	const adapter = getTerminal(terminal);
	if (!adapter) return false;
	const clean = sanitizeTitle(title);
	if (!clean) return false;
	return adapter.setTabTitle({ program: program ?? wezterm, paneId, title: clean, env, runner });
}

/** pane 是否仍存在：true/false/undefined（无法判断）。 */
export function paneExists(paneId, { terminal = terminalId(), wezterm, program, env = process.env, runner } = {}) {
	const adapter = getTerminal(terminal);
	if (!adapter) return undefined;
	return adapter.paneExists(paneId, { program: program ?? wezterm, env, runner });
}

/** 当前 pane 所属 WezTerm GUI 客户端 PID。 */
export function clientPid({ terminal = terminalId(), wezterm, program, paneId, env = process.env, runner } = {}) {
	const adapter = getTerminal(terminal);
	if (!adapter) return undefined;
	return adapter.clientPid?.({ program: program ?? wezterm, paneId, env, runner });
}

/** 当前 WezTerm mux 上全部有效 GUI 客户端 PID。 */
export function clientPids({ terminal = terminalId(), wezterm, program, env = process.env, runner } = {}) {
	const adapter = getTerminal(terminal);
	if (!adapter) return undefined;
	return adapter.clientPids?.({ program: program ?? wezterm, env, runner });
}

/** 当前 WezTerm 实例的 pane 列表。 */
export function listPanes({ terminal = terminalId(), wezterm, program, env = process.env, runner } = {}) {
	const adapter = getTerminal(terminal);
	if (!adapter) return undefined;
	return adapter.listPanes?.({ program: program ?? wezterm, env, runner });
}

/** 除指定 pane 外是否还有其他 pane：true/false/undefined（无法判断）。 */
export function otherPanesExist(excludePaneId, { terminal = terminalId(), wezterm, program, env = process.env, runner } = {}) {
	const adapter = getTerminal(terminal);
	if (!adapter) return undefined;
	return adapter.otherPanesExist?.(excludePaneId, { program: program ?? wezterm, env, runner });
}
