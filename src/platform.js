import { readFileSync } from "node:fs";
import { win32 } from "node:path";

export function runtimePlatform(env = process.env, platform = process.platform) {
	if (platform !== "linux") return platform;
	if (env.WSL_DISTRO_NAME || env.WSL_INTEROP) return "wsl";
	try {
		if (/microsoft/i.test(readFileSync("/proc/sys/kernel/osrelease", "utf8"))) return "wsl";
	} catch { /* Not a Linux procfs. */ }
	return "linux";
}

export function envValue(env, name) {
	return env[name] ?? Object.entries(env).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1];
}

export function powershellPath(env = process.env) {
	return win32.join(envValue(env, "SystemRoot") || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
}

export function powershellArgs(script, { probe = false } = {}) {
	if (probe) script = "$ProgressPreference = 'SilentlyContinue'; " + script;
	return ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")];
}
