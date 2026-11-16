import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { powershellArgs, powershellPath } from "./platform.js";

const readText = (p) => readFileSync(p, "utf8");
function query(program, args, execFile) {
	return String(execFile(program, args, {
		encoding: "utf8", timeout: 8000, windowsHide: true,
		env: { ...process.env, LC_ALL: "C" },
	})).trim();
}
let cachedBootId;

/** Stable boot identity; cache only the successful native query in this process. */
export function currentBootId(readFile = readText, { platform = process.platform, execFile = execFileSync } = {}) {
	try {
		if (platform === "linux") return readFile("/proc/sys/kernel/random/boot_id").trim() || undefined;
		if (execFile === execFileSync && cachedBootId) return cachedBootId;
		let boot;
		if (platform === "darwin") {
			const value = query("/usr/sbin/sysctl", ["-n", "kern.boottime"], execFile);
			const match = /sec\s*=\s*(\d+),\s*usec\s*=\s*(\d+)/.exec(value);
			if (match) boot = `darwin:${match[1]}:${match[2]}`;
		} else if (platform === "win32") {
			const value = query(powershellPath(), powershellArgs("$ErrorActionPreference = 'Stop'; (Get-CimInstance Win32_OperatingSystem).LastBootUpTime.ToUniversalTime().Ticks.ToString()"), execFile);
			if (/^\d+$/.test(value)) boot = `win32:${value}`;
		}
		if (execFile === execFileSync && boot) cachedBootId = boot;
		return boot;
	} catch {
		return undefined;
	}
}

/** Process creation identity, not just a PID existence check. */
export function processStart(pid, readFile = readText, { platform = process.platform, execFile = execFileSync } = {}) {
	if (!Number.isSafeInteger(pid) || pid <= 0) return undefined;
	try {
		if (platform === "darwin") {
			const value = query("/bin/ps", ["-p", String(pid), "-o", "stat=", "-o", "lstart="], execFile);
			const match = /^(\S+)\s+(.+)$/.exec(value);
			return match && !match[1].includes("Z") ? match[2].replace(/\s+/g, " ") : undefined;
		}
		if (platform === "win32") {
			const value = query(powershellPath(), powershellArgs(`$ErrorActionPreference = 'Stop'; (Get-Process -Id ${pid}).StartTime.ToUniversalTime().Ticks.ToString()`), execFile);
			return /^\d+$/.test(value) ? value : undefined;
		}
		if (platform !== "linux") return undefined;
		const stat = readFile(`/proc/${pid}/stat`);
		const after = stat.slice(stat.lastIndexOf(")") + 2).trim().split(/\s+/);
		if (after[0] === "Z") return undefined;
		return after[19];
	} catch {
		return undefined;
	}
}

/**
 * 记录所指向的 Pi 进程是否仍在同一启动周期内存活。
 * bootId 不一致（重启过）一律视为不存活——满足“重启后失效 PID 不误判”。
 */
export function isLive(entry, deps = {}) {
	if (!entry?.pid || !entry?.processStart || !entry?.bootId) return false;
	// bootId 允许传值或函数，便于调用方复用已读取的值
	const boot = typeof deps.bootId === "function" ? deps.bootId() : (deps.bootId ?? currentBootId());
	if (boot !== entry.bootId) return false;
	const start = deps.processStart
		? deps.processStart(entry.pid)
		: processStart(entry.pid);
	return start === entry.processStart;
}
