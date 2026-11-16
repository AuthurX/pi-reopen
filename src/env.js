import { envValue } from "./platform.js";

/**
 * 环境变量兼容：canonical 为 PI_REOPEN_*，旧版 PI_WORKSPACE_* 继续生效
 * （canonical 优先）。0.x 期间统一命名，但已有用户不需要改脚本。
 */
export function envCompat(env, name) {
	const legacy = name.replace(/^PI_REOPEN_/, "PI_WORKSPACE_");
	return env[name] ?? env[legacy]
		?? envValue(env, name) ?? envValue(env, legacy);
}

export function legacyEnvName(name) {
	return name.replace(/^PI_REOPEN_/, "PI_WORKSPACE_");
}
