import { envCompat } from "../env.js";
import * as wezterm from "./wezterm.js";

/**
 * 终端适配器注册表。每个适配器实现：
 *   id, discover(env, deps), spawnTab(args), setTabTitle(args),
 *   paneExists(paneId, args), otherPanesExist(excludePaneId, args), currentPaneId(env)
 * 见 docs/TERMINALS.md。
 */
export const TERMINALS = { wezterm };

export function listTerminals() {
	return Object.keys(TERMINALS);
}

export function getTerminal(id = "wezterm") {
	return TERMINALS[id];
}

/** PI_REOPEN_TERMINAL 选择适配器；默认 wezterm。 */
export function terminalId(env = process.env) {
	return envCompat(env, "PI_REOPEN_TERMINAL") || "wezterm";
}
