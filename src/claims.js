import { closeSync, mkdirSync, openSync, readdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { currentBootId, processStart } from "./liveness.js";
import { workspacePaths } from "./paths.js";

export const CLAIM_TTL_MS = 60_000;
const RESTORE_LOCK_TTL_MS = 30 * 60_000;
/** 接管重试次数：每次失败都重新读取并复核持有者，避免删掉别人刚写入的新锁。 */
const TAKEOVER_ATTEMPTS = 4;

function readJson(file) {
	try {
		return JSON.parse(readFileSync(file, "utf8"));
	} catch {
		return undefined;
	}
}

/** 原子创建：O_EXCL 保证同一时刻只有一个进程能创建成功（POSIX 与 Windows 均成立）。 */
function createExclusive(file, data) {
	let fd;
	try {
		fd = openSync(file, "wx", 0o600);
	} catch (error) {
		if (error?.code === "EEXIST") return false;
		throw error;
	}
	try {
		writeFileSync(fd, data);
	} finally {
		closeSync(fd);
	}
	return true;
}

/** 同持有者刷新时间戳（不会与其他进程竞争，因为文件已归本进程所有）。 */
function writeAtomic(file, data) {
	const temp = `${file}.${process.pid}.tmp`;
	writeFileSync(temp, data, { mode: 0o600 });
	renameSync(temp, file);
}

/** 删除前复核内容，避免把其他进程刚写入的新记录删掉（ABA）。 */
function unlinkIfUnchanged(file, expected, key) {
	const current = readJson(file);
	if (!current || current[key] !== expected[key]) return false;
	try {
		unlinkSync(file);
		return true;
	} catch {
		return false;
	}
}

export function readClaim(sessionId, paths = workspacePaths()) {
	return readJson(join(paths.claims, `${sessionId}.json`));
}

/** 声明仍有效：未过期且持有进程存活。list 用它显示“启动占用中”。 */
export function activeClaim(sessionId, paths = workspacePaths(), now = Date.now()) {
	const claim = readClaim(sessionId, paths);
	if (!claim) return undefined;
	if (now - claim.ts >= CLAIM_TTL_MS) return undefined;
	return processStart(claim.pid) !== undefined ? claim : undefined;
}

/**
 * 声明“本会话正在被启动”，防止并发/连续恢复重复开标签页。
 * 创建走 O_EXCL：两个恢复进程同一瞬间声明同一会话时只有一个能成功，
 * 不再依赖“先读后写”的 TOCTOU 窗口。
 */
export function claimSession(sessionId, ownerPid, paths = workspacePaths(), now = Date.now()) {
	mkdirSync(paths.claims, { recursive: true });
	const file = join(paths.claims, `${sessionId}.json`);
	const record = JSON.stringify({ pid: ownerPid, ts: now });
	for (let attempt = 0; attempt < TAKEOVER_ATTEMPTS; attempt++) {
		if (createExclusive(file, record)) return { claimed: true };
		const existing = readJson(file);
		if (!existing) return { claimed: false }; // 正在被其他进程写入：保守地视为已占用
		if (existing.pid === ownerPid) {
			writeAtomic(file, record);
			return { claimed: true };
		}
		if (now - existing.ts < CLAIM_TTL_MS && processStart(existing.pid) !== undefined) {
			return { claimed: false, holder: existing };
		}
		unlinkIfUnchanged(file, existing, "pid");
	}
	return { claimed: false, holder: readJson(file) };
}

/** 新 Pi 完成登记时清除自己的启动声明。 */
export function releaseClaim(sessionId, paths = workspacePaths()) {
	try {
		unlinkSync(join(paths.claims, `${sessionId}.json`));
	} catch {
		/* 不存在即目标状态 */
	}
}

/** 清理过期或持有者已死的声明（恢复前调用）。 */
export function sweepClaims(paths = workspacePaths(), now = Date.now()) {
	let files;
	try {
		files = readdirSync(paths.claims);
	} catch {
		return;
	}
	for (const file of files.filter((f) => f.endsWith(".json"))) {
		try {
			const claim = JSON.parse(readFileSync(join(paths.claims, file), "utf8"));
			const dead = now - claim.ts >= CLAIM_TTL_MS || processStart(claim.pid) === undefined;
			if (dead) unlinkSync(join(paths.claims, file));
		} catch {
			/* 损坏声明留待 TTL 后接管 */
		}
	}
}

/**
 * 全局恢复锁：同一时间只允许一个恢复进程批量开标签页，
 * 防止并发恢复叠加成 WSL 标签页风暴（曾导致 WezTerm 卡死崩溃）。
 * 占用用 O_EXCL 原子创建，不再是“读后写”。
 * 接管条件：无锁 / 锁记录损坏或正在被写入 / 同一 pid / 跨启动周期（bootId 不一致）
 * / 持有者进程已死 / 超过 30 分钟 TTL。
 */
export function acquireRestoreLock(paths = workspacePaths(), pid = process.pid, now = Date.now(), bootId = currentBootId()) {
	mkdirSync(paths.workspace, { recursive: true });
	const file = join(paths.workspace, "restore.lock");
	const record = JSON.stringify({ pid, ts: now, bootId });
	for (let attempt = 0; attempt < TAKEOVER_ATTEMPTS; attempt++) {
		if (createExclusive(file, record)) return { locked: false };
		const existing = readJson(file);
		if (!existing) return { locked: true }; // 其他进程刚创建、尚未写完：视为被占用
		if (existing.pid === pid) {
			writeAtomic(file, record);
			return { locked: false };
		}
		const sameBoot = bootId !== undefined && existing.bootId === bootId;
		const fresh = now - existing.ts < RESTORE_LOCK_TTL_MS;
		const alive = processStart(existing.pid) !== undefined;
		if (sameBoot && fresh && alive) return { locked: true, holder: existing };
		unlinkIfUnchanged(file, existing, "pid");
	}
	return { locked: true, holder: readJson(file) };
}

/** 释放全局恢复锁（只释放自己的锁）。 */
export function releaseRestoreLock(paths = workspacePaths(), pid = process.pid) {
	const file = join(paths.workspace, "restore.lock");
	const lock = readJson(file);
	if (lock?.pid === pid) {
		try {
			unlinkSync(file);
		} catch {
			/* 无锁即目标状态 */
		}
	}
}
