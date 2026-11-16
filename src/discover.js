import { getTerminal, terminalId } from "./terminals/index.js";

/**
 * WezTerm 发现（兼容入口）：委托给终端适配器。
 * 新代码应使用 getTerminal(terminalId(env)).discover(env, deps)。
 */
export function discoverWezterm(env = process.env, deps = {}) {
	const adapter = getTerminal(terminalId(env));
	return adapter?.discover(env, deps);
}
