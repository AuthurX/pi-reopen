import { resolveLang, t } from "./i18n.js";
import { getTerminal, terminalId } from "./terminals/index.js";

export { shellQuote } from "./launch.js";
export { SPAWN_TIMEOUT_MS, buildTabScript } from "./terminals/wezterm.js";

/**
 * 请求当前终端打开一个标签页。ok 只代表“请求被接受”，
 * 不代表 pi 已成功启动——后者由 verify 阶段确认。
 * terminal 决定使用哪个适配器（目前只有 wezterm）。
 */
export async function openTab({ terminal = terminalId(), wezterm, ...rest } = {}) {
	const adapter = getTerminal(terminal);
	if (!adapter) {
		return { ok: false, error: t(resolveLang(rest.env ?? process.env), "spawn.unknownTerminal", { terminal }) };
	}
	return adapter.spawnTab({ program: wezterm, ...rest });
}
