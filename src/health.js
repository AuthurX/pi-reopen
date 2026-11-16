import { accessSync, constants, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolveLang, t } from "./i18n.js";
import { listMembers } from "./members.js";
import { workspacePaths } from "./paths.js";
import { packageVersion } from "./version.js";

export const EXTENSION_RECORD = "extension.json";

/** 扩展加载时写下的自述文件，供 doctor 判断“扩展到底有没有在跑”。 */
export function writeExtensionRecord(entry, paths = workspacePaths()) {
	mkdirSync(paths.workspace, { recursive: true });
	const file = join(paths.workspace, EXTENSION_RECORD);
	const temp = `${file}.${process.pid}.tmp`;
	writeFileSync(temp, JSON.stringify(entry, null, 2), { mode: 0o600 });
	renameSync(temp, file);
}

export function readExtensionRecord(paths = workspacePaths()) {
	try {
		return JSON.parse(readFileSync(join(paths.workspace, EXTENSION_RECORD), "utf8"));
	} catch {
		return undefined;
	}
}

/** 登记目录健康度：目录是否存在/可写、成员数量、最近登记时间、扩展自述与 CLI 版本。 */
export function registryHealth({ paths = workspacePaths(), env = process.env } = {}) {
	const dirExists = existsSync(paths.workspace);
	let writable = false;
	if (dirExists) {
		try {
			accessSync(paths.workspace, constants.W_OK);
			writable = true;
		} catch {
			/* 不可写 */
		}
	}
	const members = listMembers(paths);
	const lastRegisteredAt = members.reduce((max, member) => Math.max(max, member.ts ?? 0), 0) || undefined;
	return {
		workspace: paths.workspace,
		dirExists,
		writable,
		memberCount: members.length,
		lastRegisteredAt,
		extension: readExtensionRecord(paths),
		cliVersion: packageVersion(),
		env,
	};
}

/** 把健康度转成与 preflight 相同形状的检查项，交给 doctor 统一打印。 */
export function healthChecks(health, lang = resolveLang(health.env)) {
	const checks = [];
	const add = (name, ok, detail, hint) => checks.push({ name, ok, detail, hint: ok ? undefined : hint });

	add(
		t(lang, "health.registry"),
		health.dirExists && health.writable,
		health.dirExists
			? (health.writable ? health.workspace : `${health.workspace}（${t(lang, "health.notWritable")}）`)
			: t(lang, "health.registryMissing"),
		health.dirExists ? t(lang, "health.registryHint") : t(lang, "health.registryMissingHint"),
	);

	const ext = health.extension;
	add(
		t(lang, "health.extension"),
		!!ext,
		ext
			? t(lang, "health.extensionDetail", { version: ext.version ?? "?", ts: ext.ts ? new Date(ext.ts).toLocaleString() : "?" })
			: t(lang, "health.extensionMissing"),
		t(lang, "health.extensionHint"),
	);

	add(
		t(lang, "health.version"),
		!ext || !ext.version || ext.version === health.cliVersion,
		t(lang, "health.versionDetail", { cli: health.cliVersion, ext: ext?.version ?? "-" }),
		t(lang, "health.versionHint"),
	);

	add(
		t(lang, "health.members"),
		true,
		t(lang, "health.membersDetail", {
			n: health.memberCount,
			last: health.lastRegisteredAt ? new Date(health.lastRegisteredAt).toLocaleString() : "-",
		}),
		t(lang, "health.membersHint"),
	);

	return checks;
}
