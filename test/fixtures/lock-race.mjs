// 并发锁竞争：多个进程在同一时刻尝试获取 restore.lock，只有应有一个成功。
import { existsSync, writeFileSync } from "node:fs";
import { acquireRestoreLock, releaseRestoreLock } from "../../src/claims.js";

const [workspace, marker, go] = process.argv.slice(2);
const paths = { workspace, claims: `${workspace}/starting`, members: `${workspace}/members` };

while (!existsSync(go)) await new Promise((resolve) => setTimeout(resolve, 5));

const result = acquireRestoreLock(paths, process.pid);
if (!result.locked) {
	writeFileSync(marker, String(process.pid));
	// 持有足够久，确保其他竞争者在窗口期内看到的都是“存活持有者”。
	await new Promise((resolve) => setTimeout(resolve, 1500));
	releaseRestoreLock(paths, process.pid);
}
