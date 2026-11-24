import { homedir } from "node:os";
import { join } from "node:path";

/** Pi agent 目录，尊重 PI_CODING_AGENT_DIR（与 pi 本体一致）。 */
export function agentDir(env = process.env) {
	return env.PI_CODING_AGENT_DIR || join(env.HOME || homedir(), ".pi", "agent");
}

/**
 * pi-reopen 全部持久化路径。
 * 0.3.0 及更早版本写入 pi-workspace/，这里保留只读合并所需的 legacy* 路径：
 * 新记录一律写入 pi-reopen/，旧记录仍可被读取、清理。
 */
export function workspacePaths(env = process.env) {
	const agent = agentDir(env);
	const workspace = join(agent, "pi-reopen");
	const legacyWorkspace = join(agent, "pi-workspace");
	return {
		agent,
		workspace,
		members: join(workspace, "members"),
		closing: join(workspace, "closing"),
		claims: join(workspace, "starting"),
		legacyWorkspace,
		legacyMembers: join(legacyWorkspace, "members"),
		legacyClaims: join(legacyWorkspace, "starting"),
		sessions: join(agent, "sessions"),
		legacyRegistry: join(agent, "pi-terminals.json"),
		legacyRecords: join(agent, "pi-terminal-records"),
	};
}
