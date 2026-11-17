import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';

const project = dirname(dirname(fileURLToPath(import.meta.url)));

/**
 * /reopen recent 补选路径：用 src 副本替换 preflight/spawn 为可观察 stub，
 * 验证候选发现、输入校验、确认流程、成功登记与失败回收。
 */
async function loadRecent(t) {
  const home = fs.mkdtempSync(join(tmpdir(), 'pi-ws-recent-'));
  const originalSignals = new Map(['SIGHUP', 'SIGTERM'].map((s) => [s, process.listeners(s)]));
  t.after(() => {
    for (const [signal, original] of originalSignals) {
      for (const listener of process.listeners(signal)) {
        if (!original.includes(listener)) process.off(signal, listener);
      }
    }
    fs.rmSync(home, { recursive: true, force: true });
    for (const key of ['PI_CODING_AGENT_DIR', 'PI_WORKSPACE_HOOKS', 'PI_WORKSPACE_SRC', 'PI_WORKSPACE_WEZTERM', 'PI_WORKSPACE_LANG', 'PI_WORKSPACE_TEST_CALLS', 'WSL_DISTRO_NAME',
      'PI_WORKSPACE_RECENT_NOWAIT', 'PI_WORKSPACE_RECENT_WAIT', 'PI_WORKSPACE_RECENT_INUSE', 'PI_WORKSPACE_TEST_REGISTER']) delete process.env[key];
  });

  const srcCopy = join(home, 'src');
  fs.cpSync(join(project, 'src'), srcCopy, { recursive: true });
  const calls = join(home, 'open-tab-calls.jsonl');
  fs.writeFileSync(join(srcCopy, 'spawn.js'), [
    'import { appendFileSync } from "node:fs";',
    'import { writeMember } from "./members.js";',
    'import { currentBootId, processStart } from "./liveness.js";',
    'export async function openTab(args) {',
    '  appendFileSync(process.env.PI_WORKSPACE_TEST_CALLS, JSON.stringify(args) + "\\n");',
    '  if (String(args.cwd).includes("FAIL")) return { ok: false, error: "stub failure" };',
    '  if (process.env.PI_WORKSPACE_TEST_REGISTER === "1") {',
    '    const id = String(args.sessionFile).split(/[\\\\/]/).pop().replace(/\.jsonl$/, "");',
    '    writeMember({ sessionId: id, cwd: args.cwd, sessionFile: args.sessionFile, ts: Date.now(),',
    '      pid: process.pid, processStart: processStart(process.pid), bootId: currentBootId() });',
    '  }',
    '  return { ok: true, stdout: "77" };',
    '}',
  ].join('\n'));
  fs.writeFileSync(join(srcCopy, 'preflight.js'), [
    'export function preflight() {',
    '  return { ok: true, wezterm: process.env.PI_WORKSPACE_WEZTERM, distro: process.env.WSL_DISTRO_NAME, piBin: "/custom/pi", checks: [] };',
    '}',
  ].join('\n'));

  const agentDir = join(home, '.pi', 'agent');
  process.env.PI_CODING_AGENT_DIR = agentDir;
  process.env.PI_WORKSPACE_SRC = srcCopy;
  process.env.PI_WORKSPACE_WEZTERM = join(home, 'wez.exe');
  process.env.WSL_DISTRO_NAME = 'Arch';
  process.env.PI_WORKSPACE_TEST_CALLS = calls;
  process.env.PI_WORKSPACE_HOOKS = join(project, 'test', 'fixtures', 'recent-hooks.mjs');
  process.env.PI_WORKSPACE_LANG = 'zh';
  process.env.PI_WORKSPACE_RECENT_NOWAIT = '1';
  fs.writeFileSync(join(home, 'wez.exe'), 'MZ');

  const raw = fs.readFileSync(join(project, 'extensions/index.ts'), 'utf8');
  const source = stripTypeScriptTypes(raw)
    .replace('import { Key } from "@earendil-works/pi-tui";', 'const Key = { ctrlShift: (k) => `ctrl+shift+${k}` };');
  const tempFile = join(home, 'open-all.recent.mjs');
  fs.writeFileSync(tempFile, source);
  const mod = await import(pathToFileURL(tempFile).href);

  const events = {}, commands = {}, notices = [];
  await mod.default({
    on: (name, handler) => { events[name] = handler; },
    registerCommand: (name, command) => { commands[name] = command; },
    registerShortcut() {},
  });
  const membersDir = join(agentDir, 'pi-reopen', 'members');
  const context = {
    mode: 'tui', cwd: home,
    sessionManager: { getSessionId: () => 'current', getSessionFile: () => join(home, 'current.jsonl'), getSessionName: () => 'current' },
    ui: { notify: (m) => notices.push(m), input: async () => undefined, confirm: async () => true },
  };
  // 候选会话：24 小时内、非当前会话、非存活
  function addCandidate(id, cwd, name) {
    const dir = join(agentDir, 'sessions', 'proj');
    fs.mkdirSync(dir, { recursive: true });
    fs.mkdirSync(cwd, { recursive: true });
    const file = join(dir, `${id}.jsonl`);
    const lines = [JSON.stringify({ type: 'session', id, cwd })];
    if (name) lines.push(JSON.stringify({ type: 'session_info', name }));
    fs.writeFileSync(file, lines.join('\n') + '\n');
    return file;
  }
  const readCalls = () => fs.existsSync(calls) ? fs.readFileSync(calls, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [];
  return { home, agentDir, membersDir, events, commands, notices, context, addCandidate, readCalls };
}

test('/reopen recent: candidate discovery, confirm, spawn, and member registration', async (t) => {
  const f = await loadRecent(t);
  await f.events.session_start({}, f.context);
  const file = f.addCandidate('cand', join(f.home, 'cand-cwd'));
  f.context.ui.input = async () => '1';
  await f.commands.reopen.handler('recent', f.context);
  const calls = f.readCalls();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].wezterm, join(f.home, 'wez.exe'));
  assert.equal(calls[0].distro, 'Arch');
  assert.equal(calls[0].piBin, '/custom/pi');
  assert.equal(calls[0].cwd, join(f.home, 'cand-cwd'));
  assert.equal(calls[0].sessionFile, file);
  const member = JSON.parse(fs.readFileSync(join(f.membersDir, 'cand.json'), 'utf8'));
  assert.equal(member.sessionId, 'cand');
  assert.equal(member.sessionFile, file);
  assert.ok(fs.existsSync(join(f.membersDir, '..', 'starting', 'cand.json')), '成功后保留启动声明直至新 Pi 登记');
  assert.match(f.notices.join('\n'), /已请求打开 1 个 pi 终端/);
});

test('/reopen recent: out-of-range and non-numeric input opens nothing', async (t) => {
  const f = await loadRecent(t);
  await f.events.session_start({}, f.context);
  f.addCandidate('cand', join(f.home, 'cand-cwd'));
  f.context.ui.input = async () => '99,0,abc';
  await f.commands.reopen.handler('recent', f.context);
  assert.equal(f.readCalls().length, 0);
  assert.match(f.notices.join('\n'), /序号无效/);
});

test('/reopen recent: declining confirmation opens nothing', async (t) => {
  const f = await loadRecent(t);
  await f.events.session_start({}, f.context);
  f.addCandidate('cand', join(f.home, 'cand-cwd'));
  f.context.ui.input = async () => '1';
  f.context.ui.confirm = async () => false;
  await f.commands.reopen.handler('recent', f.context);
  assert.equal(f.readCalls().length, 0);
  assert.equal(fs.existsSync(join(f.membersDir, 'cand.json')), false, '未打开不登记成员');
});

test('/reopen recent: no candidates in 24h window reports and stops', async (t) => {
  const f = await loadRecent(t);
  await f.events.session_start({}, f.context);
  await f.commands.reopen.handler('recent', f.context);
  assert.equal(f.readCalls().length, 0);
  assert.match(f.notices.join('\n'), /近 24 小时没有可补选的对话/);
});

test('/reopen recent: spawn failure releases claim, registers no member, reports error', async (t) => {
  const f = await loadRecent(t);
  await f.events.session_start({}, f.context);
  f.addCandidate('bad', join(f.home, 'FAIL-cwd'));
  f.context.ui.input = async () => '1';
  await f.commands.reopen.handler('recent', f.context);
  assert.equal(f.readCalls().length, 1, '请求仍发出');
  assert.equal(fs.existsSync(join(f.membersDir, 'bad.json')), false, '失败不登记成员');
  assert.equal(fs.existsSync(join(f.agentDir, 'pi-reopen', 'starting', 'bad.json')), false, '失败回收启动声明');
  assert.match(f.notices.join('\n'), /WezTerm 请求失败 — stub failure/);
  assert.match(f.notices.join('\n'), /没有打开任何标签页/);
});

test('/reopen recent: live and own sessions are excluded from candidates', async (t) => {
  const f = await loadRecent(t);
  await f.events.session_start({}, f.context);
  const { processStart, currentBootId } = await import('../src/liveness.js');
  // own 会话文件出现在 sessions 目录 → 按 sessionId 排除
  f.addCandidate('current', join(f.home, 'own-cwd'));
  // 存活会话 → 按 liveness 排除
  const liveFile = f.addCandidate('live', join(f.home, 'live-cwd'));
  fs.writeFileSync(join(f.membersDir, 'live.json'), JSON.stringify({
    sessionId: 'live', cwd: join(f.home, 'live-cwd'), sessionFile: liveFile, ts: Date.now(),
    pid: process.pid, processStart: processStart(process.pid), bootId: currentBootId(),
  }));
  f.context.ui.input = async () => '1';
  await f.commands.reopen.handler('recent', f.context);
  assert.equal(f.readCalls().length, 0, 'own 与 live 会话均被排除');
  assert.match(f.notices.join('\n'), /近 24 小时没有可补选的对话/);
});


test('/reopen recent: candidate list shows the cwd basename and session name, not the raw id', async (t) => {
  const f = await loadRecent(t);
  await f.events.session_start({}, f.context);
  f.addCandidate('0b6f9a1c-uuid', join(f.home, 'proj-cwd'), 'my-task');
  let prompt;
  f.context.ui.input = async (text) => { prompt = text; return undefined; };
  await f.commands.reopen.handler('recent', f.context);
  assert.match(prompt, /proj-cwd · my-task/, '候选必须显示可读的会话名');
  assert.doesNotMatch(prompt, /0b6f9a1c-uuid/, '不能只显示 UUID');
});

test('/reopen recent: candidates whose cwd is gone are skipped and reported', async (t) => {
  const f = await loadRecent(t);
  await f.events.session_start({}, f.context);
  const cwd = join(f.home, 'gone-cwd');
  f.addCandidate('gone', cwd);
  fs.rmSync(cwd, { recursive: true, force: true });
  await f.commands.reopen.handler('recent', f.context);
  assert.equal(f.readCalls().length, 0, '工作目录不存在时不得开标签页');
  assert.match(f.notices.join('\n'), /工作目录已不存在/);
});

test('/reopen recent: refuses to open tabs while another restore holds the lock', async (t) => {
  const f = await loadRecent(t);
  await f.events.session_start({}, f.context);
  f.addCandidate('cand', join(f.home, 'cand-cwd'));
  const { acquireRestoreLock, releaseRestoreLock } = await import('../src/claims.js');
  const { spawn } = await import('node:child_process');
  const holder = spawn('sleep', ['30'], { stdio: 'ignore' });
  await new Promise((resolve) => holder.once('spawn', resolve));
  t.after(() => { try { holder.kill('SIGKILL'); } catch {} });
  const paths = (await import('../src/paths.js')).workspacePaths({ PI_CODING_AGENT_DIR: f.agentDir });
  acquireRestoreLock(paths, holder.pid);
  f.context.ui.input = async () => '1';
  await f.commands.reopen.handler('recent', f.context);
  assert.equal(f.readCalls().length, 0);
  assert.match(f.notices.join('\n'), /另一个恢复进程正在进行/);
  releaseRestoreLock(paths, holder.pid);
});

test('/reopen recent: sessions already open in another Pi are not offered', async (t) => {
  const f = await loadRecent(t);
  await f.events.session_start({}, f.context);
  const file = f.addCandidate('busy', join(f.home, 'busy-cwd'));
  process.env.PI_WORKSPACE_RECENT_INUSE = file;
  await f.commands.reopen.handler('recent', f.context);
  assert.equal(f.readCalls().length, 0);
  assert.match(f.notices.join('\n'), /近 24 小时没有可补选的对话/);
});

test('/reopen recent: confirmed registration keeps the claim and reports verification', async (t) => {
  const f = await loadRecent(t);
  await f.events.session_start({}, f.context);
  f.addCandidate('cand', join(f.home, 'cand-cwd'));
  process.env.PI_WORKSPACE_RECENT_NOWAIT = '0';
  process.env.PI_WORKSPACE_TEST_REGISTER = '1';
  f.context.ui.input = async () => '1';
  await f.commands.reopen.handler('recent', f.context);
  assert.match(f.notices.join('\n'), /已确认启动/);
  assert.ok(fs.existsSync(join(f.agentDir, 'pi-reopen', 'starting', 'cand.json')), '确认后保留声明直至 Pi 自行清除');
});

test('/reopen recent: unconfirmed start releases the claim so a retry is possible', async (t) => {
  const f = await loadRecent(t);
  await f.events.session_start({}, f.context);
  f.addCandidate('cand', join(f.home, 'cand-cwd'));
  process.env.PI_WORKSPACE_RECENT_NOWAIT = '0';
  process.env.PI_WORKSPACE_RECENT_WAIT = '150';
  f.context.ui.input = async () => '1';
  await f.commands.reopen.handler('recent', f.context);
  assert.match(f.notices.join('\n'), /超时未确认启动/);
  assert.equal(fs.existsSync(join(f.agentDir, 'pi-reopen', 'starting', 'cand.json')), false, '未确认必须释放声明');
  assert.ok(fs.existsSync(join(f.membersDir, 'cand.json')), '占位记录保留，便于下次重试');
});
