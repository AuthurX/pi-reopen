import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { powershellArgs, powershellPath } from "./platform.js";

/** 会话文件规范化：用于跨进程比较同一个 jsonl。 */
export function normalizeSessionPath(file) {
	try {
		return realpathSync(resolve(file));
	} catch {
		return resolve(file);
	}
}

const SESSION_FLAG = /--session(?:=|\s+)(?:"([^"]+)"|'([^']+)'|(\S+))/;

function sessionFileFromArgv(argv) {
	const index = argv.indexOf("--session");
	if (index !== -1 && index + 1 < argv.length) return argv[index + 1];
	for (const arg of argv) {
		const match = SESSION_FLAG.exec(arg);
		if (match) return match[1] ?? match[2] ?? match[3];
	}
	return undefined;
}

/**
 * 扫描本机正在运行的 Pi 进程，建立“会话文件 → 进程 pid”映射。
 *
 * 成员记录的存活判定只能看到“登记过”的窗口；扩展未加载、记录被 clear 或损坏时，
 * 一个会话可能已经开着却没有记录。此时若再开一个 Pi，两个进程会同时向同一个
 * jsonl 追加（Pi 没有会话文件锁），属于数据损坏。恢复前用本函数兜底。
 */
export function scanSessionOwners({
	platform = process.platform,
	env = process.env,
	selfPid = process.pid,
	readdir = readdirSync,
	readFile = (file) => readFileSync(file, "utf8"),
	execFile = execFileSync,
	procDir = "/proc",
} = {}) {
	const owners = new Map();
	const record = (pid, argv) => {
		if (!Number.isSafeInteger(pid) || pid === selfPid) return;
		const file = sessionFileFromArgv(argv);
		if (!file) return;
		const key = normalizeSessionPath(file);
		if (!owners.has(key)) owners.set(key, pid);
	};

	if (platform === "linux") {
		let entries;
		try {
			entries = readdir(procDir);
		} catch {
			return owners; // 无 procfs（如受限容器）：不阻断恢复，只是少一层保护
		}
		for (const entry of entries) {
			if (!/^\d+$/.test(entry)) continue;
			let raw;
			try {
				raw = readFile(`${procDir}/${entry}/cmdline`);
			} catch {
				continue;
			}
			record(Number(entry), raw.split("\0").filter(Boolean));
		}
		return owners;
	}

	if (platform === "darwin") {
		try {
			const out = String(execFile("/bin/ps", ["-axo", "pid=,command="], {
				encoding: "utf8", timeout: 8_000, env: { ...env, LC_ALL: "C" },
			}));
			for (const line of out.split(/\r?\n/)) {
				const match = /^\s*(\d+)\s+(.*)$/.exec(line);
				if (match) record(Number(match[1]), match[2].split(/\s+/));
			}
		} catch {
			/* ps 不可用时不做额外拦截 */
		}
		return owners;
	}

	if (platform === "win32") {
		try {
			const script = "$ErrorActionPreference = 'Stop'; " +
				"Get-CimInstance Win32_Process | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress";
			const out = String(execFile(powershellPath(env), powershellArgs(script), {
				encoding: "utf8", timeout: 15_000, windowsHide: true, env,
			}));
			const list = JSON.parse(out);
			for (const proc of Array.isArray(list) ? list : [list]) {
				if (!proc?.CommandLine) continue;
				record(Number(proc.ProcessId), [proc.CommandLine]);
			}
		} catch {
			/* CIM 不可用时不做额外拦截 */
		}
		return owners;
	}

	return owners;
}
