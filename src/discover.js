import { execFileSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, posix, win32 } from "node:path";
import { envValue, runtimePlatform } from "./platform.js";

/** WezTerm 发现：显式路径 → PATH → 常见安装位置 → where.exe + wslpath。 */
export function discoverWezterm(env = process.env, deps = {}) {
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

function isFile(path) {
	try {
		return statSync(path).isFile();
	} catch {
		return false;
	}
}
