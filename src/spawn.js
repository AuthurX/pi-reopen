import { spawn } from "node:child_process";

import { resolveLang, t } from "./i18n.js";
import { launchSetup, shellQuote } from "./launch.js";
import { powershellArgs, powershellPath, runtimePlatform } from "./platform.js";
import { buildWindowsScript } from "./windows.js";
export { shellQuote } from "./launch.js";

/** wezterm cli spawn 无响应时的上限；WezTerm 卡死时避免永久阻塞。 */
export const SPAWN_TIMEOUT_MS = 15_000;

/** 登录 shell 初始化后恢复调用方 PATH 和 agent 目录，再启动已预检的 Pi。 */
export function buildTabScript({ cwd, sessionFile, piBin, env = process.env }) {
	return [
		launchSetup(env, piBin),
		`cd -- ${shellQuote(cwd)} && exec ${piBin ? shellQuote(piBin) : "pi"} --session ${shellQuote(sessionFile)}`,
	].join("; ");
}

function defaultSpawner(program, args, timeoutMs = SPAWN_TIMEOUT_MS, env = process.env) {
	return new Promise((resolve) => {
		let child;
		try {
			child = spawn(program, args, { env, detached: true, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
		} catch (error) {
			resolve({ ok: false, error: String(error) });
			return;
		}
		let stdout = "";
		let stderr = "";
		let settled = false;
		const timer = setTimeout(() => {
			settle({ ok: false, error: t(resolveLang(env), "spawn.timeout", { ms: timeoutMs }) });
			try { child.kill("SIGKILL"); } catch { /* 已退出 */ }
		}, timeoutMs);
		const settle = (result) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			resolve(result);
		};
		child.stdout?.on("data", (d) => (stdout += d));
		child.stderr?.on("data", (d) => (stderr += d));
		child.on("error", (error) => settle({ ok: false, error: String(error) }));
		child.on("close", (code) => {
			if (code === 0) settle({ ok: true, stdout: stdout.trim() });
			else settle({ ok: false, error: stderr.trim() || t(resolveLang(env), "spawn.exitCode", { code }) });
		});
	});
}

/**
 * 请求 WezTerm 打开一个标签页。返回 ok 只代表“请求被 WezTerm 接受”，
 * 不代表 pi 已成功启动——后者由 verify 阶段确认。
 * spawnTimeoutMs 限制 wezterm cli 的响应时间，防止 WezTerm 卡死时永久阻塞。
 */
export async function openTab({ wezterm, distro, cwd, sessionFile, piBin, piCommand, powershell,
	env = process.env, platform = runtimePlatform(env), spawner, spawnTimeoutMs } = {}) {
	let command;
	if (platform === "win32") {
		const script = buildWindowsScript({ cwd, sessionFile, piCommand, env });
		command = [powershell ?? powershellPath(env), ...powershellArgs(script)];
	} else if (["wsl", "linux", "darwin"].includes(platform)) {
		const script = buildTabScript({ cwd, sessionFile, piBin, env });
		command = [...(platform === "wsl" ? ["wsl.exe", ...(distro ? ["-d", distro] : []), "-e"] : []), "bash", "-lc", script];
	} else {
		return { ok: false, error: t(resolveLang(env), "spawn.unsupportedPlatform", { platform }) };
	}
	// Native paths must never be sent to an SSH/WSL domain selected by the current pane.
	const args = ["cli", "spawn", "--domain-name", "local", "--", ...command];
	const run = spawner ?? ((program, a) => defaultSpawner(program, a, spawnTimeoutMs, env));
	return run(wezterm, args);
}
