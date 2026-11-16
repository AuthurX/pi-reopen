import { existsSync, readFileSync } from "node:fs";
import { dirname, join, parse } from "node:path";

const HOST_PACKAGE = "@earendil-works/pi-coding-agent";

/** 已实机验证过的 Pi 主版本；更高主版本只提示、不阻止安装或运行。 */
export const TESTED_PI_MAJOR = 1;

/**
 * 尽力探测宿主 Pi 的版本：从进程入口向上找 package.json。
 * 找不到时返回 undefined——只影响 doctor 的提示，不影响功能。
 */
export function detectPiVersion({ entry = process.argv[1], readFile = (file) => readFileSync(file, "utf8"), exists = existsSync } = {}) {
	if (!entry) return undefined;
	let dir = dirname(entry);
	const root = parse(dir).root;
	for (let depth = 0; depth < 8 && dir && dir !== root; depth++) {
		const pkgPath = join(dir, "package.json");
		if (exists(pkgPath)) {
			try {
				const pkg = JSON.parse(readFile(pkgPath));
				if (pkg?.name === HOST_PACKAGE && typeof pkg.version === "string") return pkg.version;
			} catch {
				/* 损坏的 package.json 继续向上找 */
			}
		}
		const parent = dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	return undefined;
}

export function piMajor(version) {
	const match = /^(\d+)\./.exec(String(version ?? ""));
	return match ? Number(match[1]) : undefined;
}
