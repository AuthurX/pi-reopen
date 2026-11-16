import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { discoverWezterm } from "../src/discover.js";
import { parsePaneId, setTabTitle } from "../src/pane.js";
import { openTab } from "../src/spawn.js";

/**
 * 真实 WezTerm 集成测试：验证 argv 拼装、pane id 解析和标题设置，
 * 这些是 mock spawner 覆盖不到的路径。
 * 默认跳过；设置 PI_REOPEN_INTEGRATION=1 且本机有运行中的 WezTerm 时执行。
 */
const enabled = process.env.PI_REOPEN_INTEGRATION === "1";
const wezterm = enabled ? discoverWezterm() : undefined;
const muxReady = !!wezterm
	&& spawnSync(wezterm, ["cli", "list", "--format", "json"], { encoding: "utf8" }).status === 0;
const skip = muxReady ? false : "需要 PI_REOPEN_INTEGRATION=1 且本机有运行中的 WezTerm";

function listPanes() {
	const out = spawnSync(wezterm, ["cli", "list", "--format", "json"], { encoding: "utf8" });
	assert.equal(out.status, 0, out.stderr);
	return JSON.parse(out.stdout);
}

test("real wezterm cli spawn creates a pane, and set-tab-title applies", { skip }, async (t) => {
	const work = mkdtempSync(join(tmpdir(), "pi-reopen-integration-"));
	t.after(() => rmSync(work, { recursive: true, force: true }));
	const sleeper = join(work, "fake-pi.sh");
	writeFileSync(sleeper, "#!/bin/sh\nsleep 20\n");
	chmodSync(sleeper, 0o755);

	const result = await openTab({
		wezterm,
		cwd: work,
		sessionFile: join(work, "session.jsonl"),
		piBin: sleeper,
	});
	assert.equal(result.ok, true, result.error);
	const paneId = parsePaneId(result.stdout);
	assert.ok(paneId > 0, `spawn 必须返回 pane id，实际：${result.stdout}`);

	t.after(() => spawnSync(wezterm, ["cli", "kill-pane", "--pane-id", String(paneId)]));
	assert.ok(listPanes().some((pane) => pane.pane_id === paneId), "新 pane 必须出现在 cli list 中");

	const title = `pi-reopen-test-${process.pid}`;
	assert.equal(setTabTitle({ wezterm, paneId, title }), true);
	const pane = listPanes().find((p) => p.pane_id === paneId);
	assert.equal(pane?.tab_title, title, "标签页标题必须被真正设置");
});
