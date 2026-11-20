import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';

const project = dirname(dirname(fileURLToPath(import.meta.url)));

/** 需要 /run/WSL 互操作的测试仅在 WSL 内运行（CI 为普通 Linux，跳过）。 */
const ON_WSL = fs.existsSync('/run/WSL');
const wslOnly = { skip: ON_WSL ? false : '仅 WSL（需 /run/WSL 互操作）' };

// 用真实 Node（原生 TS 类型剥离）加载扩展模块，配合假 Pi API 验证接线与生命周期。
async function loadExtension(t, { hooks = 'test-hooks.mjs' } = {}) {
  const home = fs.mkdtempSync(join(tmpdir(), 'pi-ws-ext-'));
  const originalSignals = new Map(['SIGHUP', 'SIGTERM'].map(s => [s, process.listeners(s)]));
  t.after(() => {
    for (const [signal, original] of originalSignals) {
      for (const listener of process.listeners(signal)) {
        if (!original.includes(listener)) process.off(signal, listener);
      }
    }
    fs.rmSync(home, { recursive: true, force: true });
    for (const key of ['PI_CODING_AGENT_DIR', 'PI_WORKSPACE_HOOKS', 'PI_WORKSPACE_SRC', 'PI_WORKSPACE_WEZTERM',
      'WEZTERM_PANE', 'PI_WORKSPACE_PANE_ALIVE', 'PI_WORKSPACE_OTHER_PANES',
      'PI_WORKSPACE_FORGET_ON_TAB_CLOSE']) delete process.env[key];
  });
  process.env.PI_CODING_AGENT_DIR = join(home, '.pi', 'agent');
  process.env.PI_WORKSPACE_LANG = 'zh';
  process.env.PI_WORKSPACE_SRC = join(project, 'src');
  process.env.PI_WORKSPACE_WEZTERM = join(home, 'wez.exe');
  fs.writeFileSync(join(home, 'wez.exe'), 'MZ');
  process.env.PI_WORKSPACE_HOOKS = join(project, 'test', 'fixtures', hooks);

  const raw = fs.readFileSync(join(project, 'extensions/index.ts'), 'utf8');
  const source = stripTypeScriptTypes(raw)
    // 测试环境没有宿主提供的 pi-tui；替换为等价最小实现
    .replace('import { Key } from "@earendil-works/pi-tui";', 'const Key = { ctrlShift: (k) => `ctrl+shift+${k}` };');
  const tempFile = join(home, 'open-all.test.mjs');
  fs.writeFileSync(tempFile, source);
  const mod = await import(pathToFileURL(tempFile).href);

  const events = {}, commands = {}, notices = [];
  await mod.default({
    on: (name, handler) => { events[name] = handler; },
    registerCommand: (name, command) => { commands[name] = command; },
    registerShortcut() {},
  });
  const agentDir = join(home, '.pi', 'agent');
  const membersDir = join(agentDir, 'pi-reopen', 'members');
  const memberCount = () => { try { return fs.readdirSync(membersDir).length; } catch { return 0; } };
  const context = {
    mode: 'tui', cwd: home,
    sessionManager: { getSessionId: () => 'current', getSessionFile: () => join(home, 'current.jsonl'), getSessionName: () => 'current' },
    ui: { notify: (message) => notices.push(message), input: async () => undefined, confirm: async () => false },
  };
  return { home, agentDir, membersDir, memberCount, events, commands, notices, context,
    hooks: (await import(pathToFileURL(join(project, 'test', 'fixtures', 'test-hooks.mjs')))) };
}

test('registration write failures notify once and never throw', async (t) => {
  const f = await loadExtension(t);
  // 用一个同名文件占住 members 目录，让 writeMember 必然失败。
  fs.writeFileSync(join(f.agentDir, 'pi-reopen', 'members'), 'not-a-dir');
  f.events.session_start({}, f.context);
  f.events.message_end({ message: { role: 'user' } }, f.context);
  f.events.message_end({ message: { role: 'user' } }, f.context);
  const warnings = f.notices.filter((notice) => /登记写入失败/.test(notice));
  assert.equal(warnings.length, 1, '写失败只提示一次，且不能抛到 Pi 的消息流程里');
});

test('a changed Pi extension API warns once instead of silently stopping', async (t) => {
  const f = await loadExtension(t);
  const ctx = { ...f.context, sessionManager: {} };
  f.events.session_start({}, ctx);
  f.events.message_end({ message: { role: 'user' } }, ctx);
  const warnings = f.notices.filter((notice) => /扩展 API 可能已变更/.test(notice));
  assert.equal(warnings.length, 1, 'API 变更必须显式告警一次');
  assert.equal(f.memberCount(), 0);
});

test('/name changes refresh the registered name immediately', async (t) => {
  const f = await loadExtension(t);
  f.events.session_start({}, f.context);
  const ctx = { ...f.context, sessionManager: { ...f.context.sessionManager, getSessionName: () => 'renamed-task' } };
  f.events.session_info_changed({ name: 'renamed-task' }, ctx);
  const member = JSON.parse(fs.readFileSync(join(f.membersDir, 'current.json'), 'utf8'));
  assert.equal(member.name, 'renamed-task');
});

test('extension writes a self-record so doctor can detect it', async (t) => {
  const f = await loadExtension(t);
  const record = JSON.parse(fs.readFileSync(join(f.agentDir, 'pi-reopen', 'extension.json'), 'utf8'));
  assert.match(record.version, /^\d+\.\d+\.\d+/);
  assert.equal(record.schemaVersion, 2);
  assert.ok(record.ts > 0);
  assert.equal(record.pid, process.pid);
});

test('extension registers command/shortcut; only tui mode records members', async (t) => {
  const f = await loadExtension(t);
  assert.ok(f.commands.reopen, '/reopen must be registered');
  f.events.session_start({}, { ...f.context, mode: 'print' });
  assert.equal(fs.existsSync(f.membersDir), false, 'print mode must not register members');
  f.events.session_start({}, f.context);
  assert.equal(f.memberCount(), 1, 'tui mode registers the live member');
  const member = JSON.parse(fs.readFileSync(join(f.membersDir, 'current.json'), 'utf8'));
  assert.equal(member.sessionId, 'current');
  assert.equal(member.cwd, f.home);
  assert.ok(member.pid > 0 && member.bootId, 'live identity recorded');
  assert.equal(member.schemaVersion, 2, '记录结构版本必须落盘');
  assert.ok(['wsl', 'linux', 'darwin', 'win32'].includes(member.platform), '记录来源平台');
  assert.equal(typeof member.user, 'string', '记录用户，便于诊断跨用户共用目录');
});

test('new sessions register lazily after the first user message persists a file', async (t) => {
  const f = await loadExtension(t);
  let file;
  const ctx = { ...f.context, sessionManager: { ...f.context.sessionManager, getSessionFile: () => file } };
  f.events.session_start({}, ctx);
  assert.equal(f.memberCount(), 0, 'brand-new window without file must not register yet');
  file = join(f.home, 'new-session.jsonl');
  fs.writeFileSync(file, '{}\n');
  f.events.message_end({ message: { role: 'assistant' } }, ctx);
  assert.equal(f.memberCount(), 0, 'only user messages trigger lazy registration');
  f.events.message_end({ message: { role: 'user' } }, ctx);
  assert.equal(f.memberCount(), 1, 'first persisted user message registers the session');
  const member = JSON.parse(fs.readFileSync(join(f.membersDir, 'current.json'), 'utf8'));
  assert.equal(member.sessionFile, file);
  await f.events.session_shutdown({ reason: 'quit' }, ctx);
  assert.equal(f.memberCount(), 0, 'graceful quit still excludes lazily registered sessions');
});

test('shutdown: quit excludes, switch excludes, reload keeps', async (t) => {
  const f = await loadExtension(t);
  f.events.session_start({}, f.context);
  await f.events.session_shutdown({ reason: 'reload' }, f.context);
  assert.equal(f.memberCount(), 1, 'reload keeps the member');
  f.events.session_start({}, f.context); // Pi starts a new runtime after reload.
  await f.events.session_shutdown({ reason: 'quit' }, f.context);
  assert.equal(f.memberCount(), 0, 'graceful quit excludes the member');
  await f.events.session_shutdown({ reason: 'quit' }, f.context); // 幂等
  f.events.session_start({}, f.context);
  await f.events.session_shutdown({ reason: 'resume' }, f.context);
  assert.equal(f.memberCount(), 0, 'switching away lets the new session take over');
});

for (const signal of ['SIGHUP', 'SIGTERM']) {
  test(`${signal} followed by Pi quit cleanup preserves the member, even with host listener first`, async (t) => {
    const f = await loadExtension(t);
    f.events.session_start({}, f.context);
    let shutdown;
    const host = () => { shutdown = f.events.session_shutdown({ reason: 'quit' }, f.context); };
    process.prependListener(signal, host);
    t.after(() => process.off(signal, host));
    // Dispatch only our fixture's listeners; never signal the test runner itself.
    for (const listener of [...process.listeners(signal)]) listener();
    await shutdown;
    assert.equal(f.memberCount(), 1, 'terminal shutdown must not delete the restore member');
  });
}

test('quit keeps the member when the WezTerm pane is already gone (window close without a signal)', async (t) => {
  const f = await loadExtension(t, { hooks: 'pane-hooks.mjs' });
  process.env.WEZTERM_PANE = '42';
  f.events.session_start({}, f.context);
  await f.events.session_shutdown({ reason: 'quit' }, f.context);
  assert.equal(f.memberCount(), 1, 'pane 已消失 → 被动死亡 → 必须保留记录');
});

test('quit removes the member when the pane still exists (deliberate /quit)', async (t) => {
  const f = await loadExtension(t, { hooks: 'pane-hooks.mjs' });
  process.env.WEZTERM_PANE = '42';
  process.env.PI_WORKSPACE_PANE_ALIVE = '1';
  f.events.session_start({}, f.context);
  await f.events.session_shutdown({ reason: 'quit' }, f.context);
  assert.equal(f.memberCount(), 0, 'pane 还在 → 用户主动退出 → 排除');
});

test('forget-on-tab-close: closing one tab (other panes remain) removes the member', async (t) => {
  const f = await loadExtension(t, { hooks: 'pane-hooks.mjs' });
  process.env.WEZTERM_PANE = '42';
  process.env.PI_WORKSPACE_FORGET_ON_TAB_CLOSE = '1';
  process.env.PI_WORKSPACE_OTHER_PANES = '1';
  f.events.session_start({}, f.context);
  await f.events.session_shutdown({ reason: 'quit' }, f.context);
  assert.equal(f.memberCount(), 0, '其他 tab 还在 → 单独关了这个 → 任务完成 → 删除');
});

test('forget-on-tab-close: closing the whole terminal (no other panes) keeps the member', async (t) => {
  const f = await loadExtension(t, { hooks: 'pane-hooks.mjs' });
  process.env.WEZTERM_PANE = '42';
  process.env.PI_WORKSPACE_FORGET_ON_TAB_CLOSE = '1';
  f.events.session_start({}, f.context);
  await f.events.session_shutdown({ reason: 'quit' }, f.context);
  assert.equal(f.memberCount(), 1, '没有其他 tab → 关整个终端 → 保留待恢复');
});

test('forget-on-tab-close: explicitly disabled (0) keeps the member', async (t) => {
  const f = await loadExtension(t, { hooks: 'pane-hooks.mjs' });
  process.env.WEZTERM_PANE = '42';
  process.env.PI_WORKSPACE_FORGET_ON_TAB_CLOSE = '0';
  process.env.PI_WORKSPACE_OTHER_PANES = '1';
  f.events.session_start({}, f.context);
  await f.events.session_shutdown({ reason: 'quit' }, f.context);
  assert.equal(f.memberCount(), 1, '显式关闭开关 → 保留记录');
});

test('reload cleans up signal listeners without accumulating duplicates', async (t) => {
  const f = await loadExtension(t);
  const before = process.listenerCount('SIGHUP');
  f.events.session_start({}, f.context);
  assert.equal(process.listenerCount('SIGHUP'), before + 1);
  await f.events.session_shutdown({ reason: 'reload' }, f.context);
  assert.equal(process.listenerCount('SIGHUP'), before);
  f.events.session_start({}, f.context);
  assert.equal(process.listenerCount('SIGHUP'), before + 1);
});

test('/reopen delegates to shared core: spawns only non-live members, reports via notify', wslOnly, async (t) => {
  const f = await loadExtension(t);
  f.events.session_start({}, f.context);
  const sessions = join(f.agentDir, 'sessions', 'proj');
  fs.mkdirSync(sessions, { recursive: true });
  const sessionFile = join(sessions, 't_dead.jsonl');
  fs.writeFileSync(sessionFile, '{}\n');
  fs.writeFileSync(join(f.membersDir, 'dead.json'), JSON.stringify({
    sessionId: 'dead', cwd: f.home, sessionFile, name: 'dead', ts: Date.now() - 1000,
  }));
  await f.commands.reopen.handler('', f.context);
  assert.equal(f.hooks.calls.length, 1, 'only the passive-dead member is spawned');
  const { program, args } = f.hooks.calls[0];
  assert.equal(program, join(f.home, 'wez.exe'));
  assert.equal(args.includes('Arch'), true);
  assert.equal(args.includes('-d'), true);
  assert.ok(args.at(-1).includes(sessionFile), 'restores by absolute session file');
  assert.equal(args.at(-1).includes("exec '/test/pi' --session"), true);
  assert.match(f.notices.join('\n'), /已创建标签页，超时未确认 pi 启动/);
  assert.equal(fs.readdirSync(f.membersDir).length, 2, 'own live member untouched, no duplicates');
});

test('/reopen clear empties member records', async (t) => {
  const f = await loadExtension(t);
  f.events.session_start({}, f.context);
  assert.equal(fs.readdirSync(f.membersDir).length, 1);
  await f.commands.reopen.handler('clear', f.context);
  assert.equal(f.memberCount(), 0);
  assert.match(f.notices.join('\n'), /已清空/);
});

test('extension refuses unknown argument without spawning', async (t) => {
  const f = await loadExtension(t);
  f.events.session_start({}, f.context);
  f.hooks.calls.length = 0; // 共享记录数组，先清空
  await f.commands.reopen.handler('bogus', f.context);
  assert.match(f.notices.join('\n'), /用法/);
  assert.equal(f.hooks.calls.length, 0);
});

test('/all alias still works and points to /reopen', async (t) => {
  const f = await loadExtension(t);
  f.events.session_start({}, f.context);
  f.hooks.calls.length = 0;
  await f.commands.all.handler('bogus', f.context);
  assert.match(f.notices.join('\n'), /已改名为 \/reopen/);
  assert.match(f.notices.join('\n'), /用法/);
  assert.equal(f.hooks.calls.length, 0);
});
