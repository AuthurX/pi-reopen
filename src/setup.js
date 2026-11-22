import { spawnSync } from "node:child_process";
import { accessSync, constants, readFileSync, readdirSync, statSync } from "node:fs";
import { delimiter, join, posix, win32 } from "node:path";
import { resolveLang, t } from "./i18n.js";
import { envValue, runtimePlatform } from "./platform.js";
import { packageVersion } from "./version.js";

function isFile(path, executable = false) {
	try {
		if (!statSync(path).isFile()) return false;
		if (executable && process.platform !== "win32") accessSync(path, constants.X_OK);
		return true;
	} catch {
		return false;
	}
}

function packageSource(value) {
	if (typeof value === "string") return value;
	if (value && typeof value === "object") {
		for (const key of ["source", "package", "path"]) {
			if (typeof value[key] === "string") return value[key];
		}
	}
	return undefined;
}

function isReopenSource(source) {
	return /(?:^|[:/])@ellieyujin\/pi-reopen(?:@|$)/i.test(source)
		|| /(?:^|[:/])pi-(?:reopen|workspace)(?:@|$)/i.test(source)
		|| /github\.com[/:]AuthurX\/pi-reopen(?:$|[/@#])/i.test(source);
}

export function extensionInstallation(paths, health) {
	let sources = [];
	try {
		const settings = JSON.parse(readFileSync(join(paths.agent, "settings.json"), "utf8"));
		const packages = Array.isArray(settings.packages) ? settings.packages : [];
		sources = [...new Set(packages.map(packageSource).filter((value) => value && isReopenSource(value)))];
	} catch {
		/* 没有设置文件或旧格式不可读时，运行中自述仍可作为安装证据。 */
	}
	let localEntries = [];
	try {
		localEntries = readdirSync(join(paths.agent, "extensions"))
			.filter((name) => /^(?:open-all|pi-reopen|pi-workspace)(?:\.|$)/i.test(name))
			.map((name) => join(paths.agent, "extensions", name));
	} catch {
		/* 没有个人扩展目录。 */
	}
	return {
		sources,
		localEntries,
		installed: !!(sources.length || localEntries.length || health.extension),
		duplicates: sources.length + localEntries.length > 1 ? [...sources, ...localEntries] : [],
	};
}

export function findCliOnPath(env = process.env, platform = runtimePlatform(env)) {
	const windows = platform === "win32";
	const path = windows ? win32 : posix;
	const dirs = String(envValue(env, "PATH") ?? "").split(windows ? ";" : delimiter).filter(Boolean);
	const names = windows ? ["pi-reopen.cmd", "pi-reopen.exe", "pi-reopen", "pi-reopen.ps1"] : ["pi-reopen"];
	for (const dir of dirs) {
		for (const name of names) {
			const candidate = path.join(dir.replace(/^"|"$/g, ""), name);
			if (isFile(candidate, true)) return candidate;
		}
	}
	return undefined;
}

function windowsShimVersion(command) {
	for (const name of ["@ellieyujin/pi-reopen", "pi-reopen"]) {
		try {
			const manifest = win32.join(win32.dirname(command), "node_modules", ...name.split("/"), "package.json");
			return JSON.parse(readFileSync(manifest, "utf8")).version;
		} catch {
			/* 尝试旧包名；非 npm 标准布局由调用方报告为未知。 */
		}
	}
	return undefined;
}

function probeCliVersion(command, env, platform, runner) {
	if (!command) return undefined;
	if (platform === "win32") return windowsShimVersion(command);
	try {
		const run = runner ?? spawnSync;
		const result = run(command, ["--version"], { env, encoding: "utf8", timeout: 5000, windowsHide: true });
		return /^pi-reopen\s+(\S+)/m.exec(String(result.stdout ?? "").trim())?.[1];
	} catch {
		return undefined;
	}
}

export function installationChecks({ env = process.env, paths, health, platform = runtimePlatform(env), lang = resolveLang(env), runner } = {}) {
	const cliVersion = packageVersion();
	const cliPath = findCliOnPath(env, platform);
	const pathVersion = probeCliVersion(cliPath, env, platform, runner);
	const installation = extensionInstallation(paths, health);
	const checks = [];
	const add = (name, ok, detail, hint, warning = false) => checks.push({ name, ok, detail, hint: ok && !warning ? undefined : hint, warning });
	add(
		t(lang, "setup.extensionInstalled"),
		installation.installed,
		installation.installed
			? t(lang, "setup.extensionInstalledDetail", { sources: [...installation.sources, ...installation.localEntries].join(", ") || t(lang, "setup.extensionRuntimeOnly") })
			: t(lang, "setup.extensionNotInstalled"),
		t(lang, "setup.installExtensionCommand"),
	);
	add(
		t(lang, "setup.cliPath"),
		!!cliPath,
		cliPath ? t(lang, "setup.cliPathDetail", { path: cliPath, version: pathVersion ?? "?" }) : t(lang, "setup.cliPathMissing"),
		t(lang, "setup.cliPathHint"),
	);
	if (cliPath) {
		const matches = !pathVersion || pathVersion === cliVersion;
		add(
			t(lang, "setup.cliPathVersion"),
			matches,
			pathVersion ? t(lang, "setup.cliPathVersionDetail", { path: pathVersion, current: cliVersion }) : t(lang, "setup.cliPathVersionUnknown"),
			t(lang, "setup.updateBothCommand"),
			!pathVersion,
		);
	}
	add(
		t(lang, "setup.duplicates"),
		!installation.duplicates.length,
		installation.duplicates.length
			? t(lang, "setup.duplicatesDetail", { entries: installation.duplicates.join(", ") })
			: t(lang, "setup.duplicatesNone"),
		t(lang, "setup.duplicatesHint"),
	);
	return { checks, installation, cliPath, pathVersion, cliVersion };
}

export function setupSteps({ env = process.env, health, result, platform = runtimePlatform(env), lang = resolveLang(env) } = {}) {
	const steps = [];
	const extensionMismatch = health.extension?.version && health.extension.version !== result.cliVersion;
	const pathMismatch = result.pathVersion && result.pathVersion !== result.cliVersion;
	if (!result.installation.installed || extensionMismatch || pathMismatch) {
		steps.push(t(lang, "setup.installExtensionCommand"));
	}
	if (!result.cliPath || extensionMismatch || pathMismatch) {
		steps.push(t(lang, "setup.installCliCommand"));
	}
	if (!result.cliPath) steps.push(t(lang, platform === "win32" ? "setup.pathCommandWindows" : "setup.pathCommandPosix"));
	if (!health.extensionRunning) steps.push(t(lang, "setup.reloadStep"));
	if (result.installation.duplicates.length) steps.push(t(lang, "setup.duplicatesStep"));
	if (!steps.length) steps.push(t(lang, "setup.restoreStep"));
	return [...new Set(steps)];
}
