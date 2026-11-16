import { readFileSync, statSync } from "node:fs";
import { win32 } from "node:path";
import { agentDir } from "./paths.js";
import { resolveLang, t } from "./i18n.js";
import { envValue } from "./platform.js";

export function powershellQuote(value) {
	return `'${value.replaceAll("'", "''")}'`;
}

function isFile(file) {
	try { return statSync(file).isFile(); } catch { return false; }
}

// Resolve npm's shim to Node + package entry instead of passing paths through cmd.exe.
export function discoverWindowsPi(env = process.env, deps = {}) {
	const fileExists = deps.isFile ?? isFile;
	const readFile = deps.readFile ?? ((file) => readFileSync(file, "utf8"));
	const explicit = env.PI_WORKSPACE_PI_BIN;
	const dirs = (envValue(env, "PATH") || "").split(";")
		.map((dir) => dir.replace(/^"|"$/g, "")).filter((dir) => win32.isAbsolute(dir));
	const candidates = explicit ? [explicit] : dirs.flatMap((dir) => ["pi.exe", "pi.cmd"].map((name) => win32.join(dir, name)));
	for (const file of candidates) {
		if (!win32.isAbsolute(file) || !fileExists(file)) continue;
		if (/\.exe$/i.test(file)) return { piBin: file, piCommand: [file] };
		let entry = /\.(?:mjs|cjs|js)$/i.test(file) ? file : undefined;
		if (/\.cmd$/i.test(file)) {
			const root = win32.join(win32.dirname(file), "node_modules", "@earendil-works", "pi-coding-agent");
			try {
				const pkg = JSON.parse(readFile(win32.join(root, "package.json")));
				const bin = typeof pkg.bin === "string" ? pkg.bin : pkg.bin?.pi;
				if (pkg.name === "@earendil-works/pi-coding-agent" && typeof bin === "string") entry = win32.resolve(root, bin);
			} catch { /* Unknown shims require an explicit JS entry or executable. */ }
		}
		if (!entry || !fileExists(entry)) continue;
		const node = [win32.join(win32.dirname(file), "node.exe"), deps.nodePath ?? process.execPath,
			...dirs.map((dir) => win32.join(dir, "node.exe"))].find((p) => win32.isAbsolute(p) && fileExists(p));
		if (node) return { piBin: file, piCommand: [node, entry] };
	}
	return undefined;
}

export function buildWindowsScript({ cwd, sessionFile, piCommand, env = process.env }) {
	if (!piCommand?.length) throw new Error(t(resolveLang(env), "windows.noPiCommand"));
	const path = [win32.dirname(piCommand[0]), envValue(env, "PATH")].filter(Boolean).join(";");
	return [
		"$ErrorActionPreference = 'Stop'",
		`$env:PATH = ${powershellQuote(path)} + ';' + $env:PATH`,
		`$env:PI_CODING_AGENT_DIR = ${powershellQuote(agentDir(env))}`,
		`Set-Location -LiteralPath ${powershellQuote(cwd)}`,
		`& ${piCommand.map(powershellQuote).join(" ")} '--session' ${powershellQuote(sessionFile)}`,
		"exit $LASTEXITCODE",
	].join("; ");
}
