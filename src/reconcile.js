import { discoverWezterm } from "./discover.js";
import { envCompat } from "./env.js";
import { currentBootId, isLive } from "./liveness.js";
import { deleteMember, readCloseIntent, readMember } from "./members.js";
import { clientPids, listPanes } from "./pane.js";
import { workspacePaths } from "./paths.js";
import { runtimePlatform } from "./platform.js";

function validPid(value) {
	return Number.isSafeInteger(value) && value > 0;
}

function validPaneId(value) {
	return Number.isSafeInteger(value) && value >= 0;
}

function sameRegistration(left, right) {
	return left?.sessionId === right?.sessionId
		&& left?.ts === right?.ts
		&& left?.pid === right?.pid
		&& left?.processStart === right?.processStart
		&& left?.bootId === right?.bootId
		&& left?.paneId === right?.paneId
		&& left?.weztermPid === right?.weztermPid;
}

/** 在健康 CLI 进程中校准 WSL 单标签关闭；无法确认同一 GUI 实例时保守保留。 */
export function reconcileClosedTabs({
	members,
	env = process.env,
	paths = workspacePaths(env),
	platform = runtimePlatform(env),
	wezterm,
	clientPidsFn = clientPids,
	listPanesFn = listPanes,
	bootId = currentBootId(),
} = {}) {
	if (platform !== "wsl") return 0;
	const forget = String(envCompat(env, "PI_REOPEN_FORGET_ON_TAB_CLOSE") ?? "").trim().toLowerCase();
	if (["0", "false", "off", "no"].includes(forget)) return 0;
	const candidates = members.filter((entry) =>
		validPaneId(entry.paneId) && validPid(entry.weztermPid) && !isLive(entry, { bootId }));
	if (!candidates.length) return 0;
	const program = wezterm ?? discoverWezterm(env);
	if (!program) return 0;
	const currentClients = clientPidsFn({ wezterm: program, env });
	if (!Array.isArray(currentClients)) return 0;
	const currentClientIds = new Set(currentClients.filter(validPid));
	if (!currentClientIds.size) return 0;
	const sameInstance = candidates.filter((entry) => currentClientIds.has(entry.weztermPid)
		&& sameRegistration(readCloseIntent(entry.sessionId, paths), entry));
	if (!sameInstance.length) return 0;
	const panes = listPanesFn({ wezterm: program, env });
	if (!Array.isArray(panes)) return 0;
	const paneIds = new Set(panes.map((pane) => pane?.pane_id).filter(validPaneId));
	if (!paneIds.size) return 0;
	let deleted = 0;
	for (const entry of sameInstance) {
		if (paneIds.has(entry.paneId)) continue;
		const current = readMember(entry.sessionId, paths);
		if (!sameRegistration(current, entry)) continue;
		deleteMember(entry.sessionId, paths);
		const index = members.indexOf(entry);
		if (index >= 0) members.splice(index, 1);
		deleted++;
	}
	return deleted;
}
