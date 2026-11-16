import { execFileSync, spawn, spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, posix, win32 } from "node:path";
import { resolveLang, t } from "../i18n.js";
import { launchSetup, shellQuote } from "../launch.js";
import { envValue, powershellArgs, powershellPath, runtimePlatform } from "../platform.js";
import { buildWindowsScript } from "../windows.js";

export const id = "wezterm";
export const PANE_QUERY_TIMEOUT_MS = 5_000;
/** wezterm cli spawn 无响应时的上限；WezTerm 卡死时避免永久阻塞。 */
export const SPAWN_TIMEOUT_MS = 15_000;

function isFile(path) {
	try {
		return statSync(path).isFile();
	} catch {
		return false;
	}
}

/** WezTerm 向 pane 内的进程注入 WEZTERM_PANE；不在 WezTerm 内运行时为 undefined。 */
export function currentPaneId(env = process.env) {
	const paneId = Number(env.WEZTERM_PANE);
	return Number.isSafeInteger(paneId) && paneId > 0 ? paneId : undefined;
}

/** 显式路径 → PATH → 常见安装位置 → where.exe + wslpath。 */
export function discover(env = process.env, deps = {}) {
	const fileExists = deps.isFile ?? isFile;
	const readdir = deps.readdir ?? readdirSync;
	const execFile = deps.execFile ?? execFileSync;
	if (env.PI_WORKSPACE_WEZTERM) {
		return fileExists(env.PI_WORKSPACE_WEZTERM) ? env.PI_WORKSPACE_WEZTERM : undefined;
	}
	const platform = deps.platform ?? runtimePlatform(env);
	if (platform !== "wsl") {
		const windows = platform === "win32";
		const path = windows ? win32 : posix;
		const name = windows ? "wezterm.exe" : "wezterm";
		const candidates = (envValue(env, "PATH") ?? "").split(windows ? ";" : ":")
			.map((dir) => dir.replace(/^"|"$/g, ""))
			.filter((dir) => path.isAbsolute(dir)).map((dir) => path.join(dir, name));
		if (windows) {
			for (const root of [envValue(env, "ProgramFiles"), envValue(env, "ProgramFiles(x86)")].filter(Boolean)) {
				candidates.push(path.join(root, "WezTerm", name));
			}
			const local = envValue(env, "LOCALAPPDATA");
			if (local) candidates.push(path.join(local, "Programs", "WezTerm", name));
			const home = envValue(env, "USERPROFILE");
			if (home) candidates.push(path.join(home, "scoop", "shims", name));
		} else {
			candidates.push("/usr/local/bin/wezterm", "/usr/bin/wezterm");
			if (platform === "darwin") candidates.push("/opt/homebrew/bin/wezterm", "/Applications/WezTerm.app/Contents/MacOS/wezterm");
		}
		return candidates.find(fileExists);
	}
	const candidates = (env.PATH ?? "").split(":").filter((p) => p.startsWith("/"))
		.map((dir) => join(dir, "wezterm.exe"));
	candidates.push("/mnt/c/Program Files/WezTerm/wezterm.exe");
	try {
		for (const drive of readdir("/mnt")) {
			candidates.push(join("/mnt", drive, "Program Files", "WezTerm", "wezterm.exe"));
			const users = join("/mnt", drive, "Users");
			let names;
			try {
				names = readdir(users);
			} catch {
				continue;
			}
			for (const user of names) {
				candidates.push(
					join(users, user, "AppData", "Local", "Programs", "WezTerm", "wezterm.exe"),
					join(users, user, "scoop", "shims", "wezterm.exe"),
				);
			}
		}
	} catch {
		/* /mnt 不可枚举时忽略 */
	}
	for (const candidate of candidates) {
		if (fileExists(candidate)) return candidate;
	}
	try {
		const options = { env, encoding: "utf8", timeout: 5000 };
		const where = (env.PATH ?? "").split(":").filter((p) => p.startsWith("/"))
			.map((dir) => join(dir, "where.exe")).find(fileExists)
			?? "/mnt/c/Windows/System32/where.exe";
		const out = execFile(where, ["wezterm.exe"], options);
		for (const line of out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)) {
			try {
				const path = execFile("wslpath", ["-u", line], options).trim();
				if (fileExists(path)) return path;
			} catch {
				/* 某个 Windows 路径不可转换时继续下一项 */
			}
		}
	} catch {
		/* interop 不可用时静默 */
	}
	return undefined;
}

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
 * 请求 WezTerm 打开一个标签页。ok 只代表“请求被接受”，
 * 不代表 pi 已成功启动——后者由 verify 阶段确认。
 */
export async function spawnTab({
	program,
	distro,
	cwd,
	sessionFile,
	piBin,
	piCommand,
	powershell,
	env = process.env,
	platform = runtimePlatform(env),
	spawner,
	spawnTimeoutMs,
} = {}) {
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
	const run = spawner ?? ((executable, a) => defaultSpawner(executable, a, spawnTimeoutMs, env));
	return run(program, args);
}

/** 设置标签页标题；失败不影响恢复结果（标题只是装饰）。 */
export function setTabTitle({ program, wezterm, paneId, title, env = process.env, runner, timeoutMs = PANE_QUERY_TIMEOUT_MS } = {}) {
	if (!Number.isSafeInteger(paneId) || paneId <= 0 || !title) return false;
	const run = runner ?? ((executable, args) =>
		spawnSync(executable, args, { env, encoding: "utf8", timeout: timeoutMs, windowsHide: true }));
	try {
		return run(program || wezterm || "wezterm", ["cli", "set-tab-title", "--pane-id", String(paneId), title])?.status === 0;
	} catch {
		return false;
	}
}

/**
 * 判断 pane 是否仍存在：
 * true 还在（主动 /quit），false 已消失（窗口关闭），undefined 无法判断。
 */
export function paneExists(paneId, { program, wezterm, env = process.env, runner, timeoutMs = PANE_QUERY_TIMEOUT_MS } = {}) {
	if (!Number.isSafeInteger(paneId) || paneId <= 0) return undefined;
	const run = runner ?? ((executable, args) =>
		spawnSync(executable, args, { env, encoding: "utf8", timeout: timeoutMs, windowsHide: true }));
	try {
		const out = run(program || wezterm || "wezterm", ["cli", "list", "--format", "json"]);
		if (out?.status !== 0) return undefined;
		const panes = JSON.parse(String(out.stdout ?? ""));
		if (!Array.isArray(panes)) return undefined;
		return panes.some((pane) => Number(pane?.pane_id) === paneId);
	} catch {
		return undefined;
	}
}

