import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolveLang, t } from "./i18n.js";

const BINFMT_ENTRY = "/proc/sys/fs/binfmt_misc/WSLInterop";
const CONF_DIRS = ["/etc/binfmt.d", "/usr/lib/binfmt.d", "/run/binfmt.d", "/lib/binfmt.d"];
export const BINFMT_CONF_CONTENT = ":WSLInterop:M::MZ::/init:PF";

/** 语言无关的一次性注册命令；说明文字由 i18n 提供。 */
export const BINFMT_FIX_COMMAND =
	"printf '%s\\n' ':WSLInterop:M::MZ::/init:P' | sudo tee /proc/sys/fs/binfmt_misc/register >/dev/null";

export function persistHint(lang = resolveLang()) {
	return t(lang, "binfmt.persistHint");
}

/**
 * WSLInterop 注册状态与持久化状态：
 * - registered：当前内核是否已注册（恢复可用性的前提）
 * - persistent：是否存在 binfmt.d 配置，使 systemd-binfmt 在启动时自动补注册
 */
export function binfmtStatus(deps = {}) {
	const exists = deps.exists ?? existsSync;
	const readFile = deps.readFile ?? ((p) => readFileSync(p, "utf8"));
	const readdir = deps.readdir ?? readdirSync;
	const registered = exists(BINFMT_ENTRY);
	let persistent = false;
	for (const dir of CONF_DIRS) {
		if (!exists(dir)) continue;
		let files;
		try {
			files = readdir(dir);
		} catch {
			continue;
		}
		for (const file of files) {
			const path = `${dir}/${file}`;
			if (file.toLowerCase().includes("wslinterop")) {
				persistent = true;
				break;
			}
			try {
				if (readFile(path).includes(":WSLInterop:")) {
					persistent = true;
					break;
				}
			} catch {
				/* 不可读文件（目录等）忽略 */
			}
		}
		if (persistent) break;
	}
	return { registered, persistent };
}
