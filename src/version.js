import { readFileSync } from "node:fs";

/** CLI 与扩展共用的包版本号（读取随包发布的 package.json）。 */
export function packageVersion() {
	try {
		const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
		return pkg.version;
	} catch {
		return "unknown";
	}
}
