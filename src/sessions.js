import { closeSync, openSync, readSync, statSync } from "node:fs";

const HEAD_BYTES = 64 * 1024;
const TAIL_BYTES = 128 * 1024;

function readRange(fd, position, length) {
	const buffer = Buffer.alloc(length);
	const bytes = readSync(fd, buffer, 0, length, position);
	return buffer.subarray(0, bytes).toString("utf8");
}

/**
 * 会话名保存在会话文件中间的 session_info 记录里（不在首行 header 中）。
 * 只读尾部窗口取“最后一次改名”，避免加载整个会话文件（可达数 MB）。
 */
export function latestSessionName(text) {
	let name;
	for (const line of text.split("\n")) {
		if (!line.includes('"session_info"')) continue;
		try {
			const entry = JSON.parse(line);
			if (entry?.type === "session_info") name = entry.name?.trim() || undefined;
		} catch {
			/* 尾部窗口可能从半行开始，忽略无法解析的行 */
		}
	}
	return name;
}

/**
 * 读取会话文件的元数据：首行 header 提供 id/cwd，尾部窗口提供当前会话名。
 * 文件损坏或不是 Pi 会话时返回 undefined。
 */
export function readSessionMeta(file, { readFile = undefined } = {}) {
	const fd = openSync(file, "r");
	try {
		const size = statSync(file).size;
		const header = JSON.parse(readRange(fd, 0, Math.min(size, HEAD_BYTES)).split("\n")[0]);
		if (!header?.id || !header?.cwd) return undefined;
		let name;
		if (size > HEAD_BYTES) {
			name = latestSessionName(readRange(fd, Math.max(0, size - TAIL_BYTES), Math.min(size, TAIL_BYTES)));
		} else {
			name = latestSessionName(readRange(fd, 0, size));
		}
		return { sessionId: header.id, cwd: header.cwd, name };
	} finally {
		closeSync(fd);
	}
}
