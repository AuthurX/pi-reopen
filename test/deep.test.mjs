import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// 断言中文输出：显式固定语言，避免依赖运行环境的 LANG。
process.env.PI_WORKSPACE_LANG ??= 'zh';
import { workspacePaths } from '../src/paths.js';
import { currentBootId, isLive, processStart } from '../src/liveness.js';
import { clearWorkspace, deleteMember, listMembers, readCloseIntent, writeCloseIntent, writeMember } from '../src/members.js';
import { CLAIM_TTL_MS, claimSession, readClaim, releaseClaim, sweepClaims } from '../src/claims.js';
import { buildRestorePlan, matchesOnly, resolveSessionFile } from '../src/plan.js';
import { normalizeSessionPath, scanSessionOwners } from '../src/inuse.js';
import { parsePaneId, sanitizeTitle } from '../src/pane.js';
import { clientPid, clientPids, currentPaneId, otherPanesExist, setTabTitle } from '../src/terminals/wezterm.js';
import { reconcileClosedTabs } from '../src/reconcile.js';
import { openTab, shellQuote } from '../src/spawn.js';
import { preflight } from '../src/preflight.js';
import { EXIT, defaultWaitTimeoutMs, exitCodeFor, inspect, label, runRestore, setTitle, summarize, tabTitle } from '../src/restore.js';
import { forgetMembers, pruneMembers, resolveMemberIds } from '../src/prune.js';
import { collectOnly, displayWidth, jsonPayload, normalizeArgv, run as cliRun } from '../src/cli.js';

/** 需要 /run/WSL 互操作的测试仅在 WSL 内运行（CI 为普通 Linux，跳过）。 */
const project = dirname(dirname(fileURLToPath(import.meta.url)));
const ON_WSL = fs.existsSync('/run/WSL');
const wslOnly = { skip: ON_WSL ? false : '仅 WSL（需 /run/WSL 互操作）' };

function fixture(t) {
  const home = fs.mkdtempSync(join(tmpdir(), 'pi-ws-deep-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const env = { HOME: home, WSL_DISTRO_NAME: 'Arch', PI_WORKSPACE_LANG: 'zh' };
  const paths = workspacePaths(env);
  fs.mkdirSync(paths.sessions, { recursive: true });
  return { home, env, paths };
}

function liveEntry(paths, id, overrides = {}) {
  const sessionFile = join(paths.sessions, 'proj', `20260101T000000_${id}.jsonl`);
  fs.mkdirSync(join(paths.sessions, 'proj'), { recursive: true });
  fs.writeFileSync(sessionFile, JSON.stringify({ type: 'session', id, cwd: paths.agent }) + '\n');
  return { sessionId: id, cwd: paths.agent, sessionFile, name: id, ts: Date.now(),
    pid: process.pid, processStart: processStart(process.pid), bootId: 'boot-x', ...overrides };
}

/** 真实存在过但已死亡的进程身份（被动死亡）；等 spawn/exit 避免 kill 先于子进程启动而失效的竞态。 */
async function deadIdentity() {
  const child = spawn('sleep', ['30'], { stdio: 'ignore' });
  await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
  const start = processStart(child.pid);
  child.kill('SIGKILL');
  await new Promise((r) => child.once('exit', r));
  return { pid: child.pid, processStart: start, bootId: 'boot-x' };
}

test('processStart parses comm with spaces/parens, treats zombies and missing procs as dead', () => {
  // /proc/pid/stat 字段 22（starttime）位于 comm 之后的第 19 位（0 起）
  const fields = 'S 1 1 1 0 -1 4194560 100 0 0 0 1 2 0 0 20 0 1 0 12345 0 0 1 0 0';
  const line = (name) => `1234 (${name}) ${fields}`;
  assert.equal(processStart(1, () => line('my proc')), '12345');
  assert.equal(processStart(1, () => line('weird)name(')), '12345', 'comm 可含括号/空格，按最后一个右括号切分');
  assert.equal(processStart(1, () => line('zombie').replace(') S ', ') Z ')), undefined, '僵尸进程视为不存活');
  assert.equal(processStart(999999, () => { throw new Error('ENOENT'); }), undefined);
});

test('isLive accepts bootId as value or function and requires matching start time', () => {
  const entry = { pid: 42, processStart: '999', bootId: 'boot-1' };
  assert.equal(isLive(entry, { bootId: 'boot-1', processStart: () => '999' }), true);
  assert.equal(isLive(entry, { bootId: () => 'boot-1', processStart: () => '999' }), true);
  assert.equal(isLive(entry, { bootId: 'boot-1', processStart: () => '1000' }), false, 'PID 重用（启动时刻不同）判死');
  assert.equal(isLive({ ...entry, bootId: undefined }), false);
});

test('claimSession: same owner reclaims; dead holder within TTL is reclaimable', async (t) => {
  const f = fixture(t);
  const holder = spawn('sleep', ['30'], { stdio: 'ignore' });
  t.after(() => { try { holder.kill('SIGKILL'); } catch {} });
  await new Promise((r) => holder.once('spawn', r));
  assert.equal(claimSession('s1', process.pid, f.paths).claimed, true);
  assert.equal(claimSession('s1', process.pid, f.paths).claimed, true, '同一持有者可重复声明');
  claimSession('s2', holder.pid, f.paths);
  holder.kill('SIGKILL');
  await new Promise((r) => holder.once('exit', r));
  assert.equal(claimSession('s2', process.pid, f.paths).claimed, true, '持有者已死时即使未过期也可接管');
});

test('restore lock is created atomically: concurrent processes cannot all win', async (t) => {
  const f = fixture(t);
  fs.mkdirSync(f.paths.workspace, { recursive: true });
  const go = join(f.home, 'go');
  const markers = Array.from({ length: 8 }, (_, i) => join(f.home, `winner-${i}`));
  const children = markers.map((marker) => spawn(process.execPath,
    [join(project, 'test/fixtures/lock-race.mjs'), f.paths.workspace, marker, go],
    { stdio: 'ignore' }));
  const exited = children.map((child) => new Promise((resolve) => child.once('exit', resolve)));
  fs.writeFileSync(go, '');
  await Promise.all(exited);
  const winners = markers.filter((marker) => fs.existsSync(marker));
  assert.equal(winners.length, 1, `应只有一个进程获得锁，实际 ${winners.length} 个`);
  assert.equal(fs.existsSync(join(f.paths.workspace, 'restore.lock')), false, '持有者退出后锁应释放');
});

test('sweepClaims removes expired and dead-holder claims, keeps fresh live and corrupt ones', async (t) => {
  const f = fixture(t);
  const holder = spawn('sleep', ['30'], { stdio: 'ignore' });
  const dead = spawn('sleep', ['30'], { stdio: 'ignore' });
  await new Promise((r) => dead.once('spawn', r));
  dead.kill('SIGKILL');
  await new Promise((r) => dead.once('exit', r));
  t.after(() => { try { holder.kill('SIGKILL'); } catch {} });
  const now = Date.now();
  claimSession('fresh', holder.pid, f.paths, now);
  claimSession('expired', holder.pid, f.paths, now - CLAIM_TTL_MS - 1);
  claimSession('deadholder', dead.pid, f.paths, now);
  fs.writeFileSync(join(f.paths.claims, 'corrupt.json'), '{oops');
  sweepClaims(f.paths, now);
  assert.ok(readClaim('fresh', f.paths), '新鲜且持有者存活 → 保留');
  assert.equal(readClaim('expired', f.paths), undefined, '过期 → 删除');
  assert.equal(readClaim('deadholder', f.paths), undefined, '持有者已死 → 删除');
  assert.ok(fs.existsSync(join(f.paths.claims, 'corrupt.json')), '损坏声明保留，待 TTL 后接管');
});

test('list shows a session that another live restore process is starting', async (t) => {
  const f = fixture(t);
  const entry = { ...liveEntry(f.paths, 'starting'), ...(await deadIdentity()) };
  writeMember(entry, f.paths);
  const holder = spawn('sleep', ['30'], { stdio: 'ignore' });
  await new Promise((resolve) => holder.once('spawn', resolve));
  t.after(() => { try { holder.kill('SIGKILL'); } catch {} });
  claimSession('starting', holder.pid, f.paths);
  const { plan } = inspect({ paths: f.paths, owners: new Map() });
  assert.equal(plan.items[0].state, 'claimed', 'list 必须能显示“启动占用中”，不能只显示待恢复');
  const out = [];
  const stdout = { write: (line) => out.push(line), columns: 200, on: () => {} };
  await cliRun(['list'], { stdout, env: { ...f.env, PI_CODING_AGENT_DIR: f.paths.agent } });
  assert.match(out.join('\n'), /启动占用中/);
  releaseClaim('starting', f.paths);
  holder.kill('SIGKILL');
});

test('plan marks sessions claimed by another restore as claimed', async (t) => {
  const f = fixture(t);
  const entry = { ...liveEntry(f.paths, 'cl'), ...(await deadIdentity()) };
  const plan = buildRestorePlan({
    members: [entry],
    paths: f.paths,
    liveFn: () => false,
    claimFn: (id) => id === 'cl',
  });
  assert.equal(plan.items[0].state, 'claimed');
  assert.equal(plan.count('claimed'), 1);
  assert.equal(plan.restorable.length, 0);
});

test('plan rejects records written by another platform or WSL distro', (t) => {
  const f = fixture(t);
  const foreign = { ...liveEntry(f.paths, 'windows-entry'), pid: undefined, platform: 'win32' };
  const otherDistro = { ...liveEntry(f.paths, 'ubuntu-entry'), pid: undefined, platform: 'wsl', distro: 'Ubuntu' };
  const sameDistro = { ...liveEntry(f.paths, 'arch-entry'), pid: undefined, platform: 'wsl', distro: 'Arch' };
  const legacy = { ...liveEntry(f.paths, 'legacy-entry'), pid: undefined };
  delete legacy.platform;
  for (const entry of [foreign, otherDistro, sameDistro, legacy]) writeMember(entry, f.paths);
  const { plan } = inspect({ paths: f.paths, platform: 'wsl', distro: 'Arch', owners: new Map() });
  const byId = Object.fromEntries(plan.items.map((i) => [i.entry.sessionId, i.state]));
  assert.equal(byId['windows-entry'], 'wrong-platform');
  assert.equal(byId['ubuntu-entry'], 'wrong-platform');
  assert.equal(byId['arch-entry'], 'restorable');
  assert.equal(byId['legacy-entry'], 'restorable', '缺少 platform 的旧记录必须继续可恢复');
});

test('plan skips a session file already opened by another Pi process (no double writer)', async (t) => {
  const f = fixture(t);
  const entry = { ...liveEntry(f.paths, 'busy'), ...(await deadIdentity()) };
  writeMember(entry, f.paths);
  const procDir = join(f.home, 'proc');
  fs.mkdirSync(join(procDir, '4242'), { recursive: true });
  fs.writeFileSync(join(procDir, '4242', 'cmdline'),
    ['/usr/bin/node', '/opt/pi', '--session', entry.sessionFile, ''].join('\0'));
  // 自己的恢复进程也必须被排除，否则每次恢复都会把自己当成占用者
  fs.mkdirSync(join(procDir, String(process.pid)), { recursive: true });
  fs.writeFileSync(join(procDir, String(process.pid), 'cmdline'),
    ['node', 'pi-reopen', '--session', entry.sessionFile, ''].join('\0'));
  const owners = scanSessionOwners({ platform: 'linux', procDir, selfPid: process.pid });
  assert.equal(owners.get(normalizeSessionPath(entry.sessionFile)), 4242);
  const { plan } = inspect({ paths: f.paths, owners });
  assert.equal(plan.items[0].state, 'in-use');
  assert.equal(plan.count('restorable'), 0);
});

test('session owner scan also understands --session=<path> and Windows command lines', (t) => {
  const f = fixture(t);
  const file = join(f.home, 'session.jsonl');
  fs.writeFileSync(file, '{}\n');
  const procDir = join(f.home, 'proc2');
  fs.mkdirSync(join(procDir, '777'), { recursive: true });
  fs.writeFileSync(join(procDir, '777', 'cmdline'), ['node', `--session=${file}`, ''].join('\0'));
  assert.equal(scanSessionOwners({ platform: 'linux', procDir, selfPid: 1 }).get(normalizeSessionPath(file)), 777);
  const win = scanSessionOwners({
    platform: 'win32', selfPid: 1,
    execFile: () => JSON.stringify([
      { ProcessId: 9, CommandLine: `"C:\\node.exe" "C:\\pi" --session "${file}"` },
      { ProcessId: 10, CommandLine: 'not a pi process' },
    ]),
  });
  assert.equal(win.get(normalizeSessionPath(file)), 9);
});

test('resolveSessionFile prefers an existing recorded path, falls back to scan', (t) => {
  const f = fixture(t);
  const direct = join(f.home, 'direct.jsonl');
  fs.writeFileSync(direct, '{}\n');
  const scanned = liveEntry(f.paths, 'pref').sessionFile;
  assert.equal(resolveSessionFile({ sessionId: 'pref', cwd: f.paths.agent, sessionFile: direct }, f.paths), direct);
  assert.equal(
    resolveSessionFile({ sessionId: 'pref', cwd: f.paths.agent, sessionFile: join(f.home, 'gone.jsonl') }, f.paths),
    scanned,
  );
});

test('preflight passes when all dependencies are present (WSL only)', (t) => {
  if (!fs.existsSync('/run/WSL')) { t.skip('非 WSL 环境，/run/WSL 不存在，无法全项通过'); return; }
  const f = fixture(t);
  const fakeWez = join(f.home, 'wezterm.exe');
  fs.writeFileSync(fakeWez, 'MZ');
  const result = preflight({
    env: f.env,
    wezterm: fakeWez,
    prober: () => ({ status: 0, stdout: 'wezterm 20260101\n' }),
    piProber: () => ({ status: 0, stdout: '/usr/bin/pi\n' }),
  });
  assert.equal(result.ok, true);
  assert.equal(result.wezterm, fakeWez);
  assert.equal(result.distro, 'Arch');
  assert.ok(result.checks.every((c) => c.ok));
});

test('preflight fails with actionable hint when pi is missing', (t) => {
  const f = fixture(t);
  const fakeWez = join(f.home, 'wezterm.exe');
  fs.writeFileSync(fakeWez, 'MZ');
  const result = preflight({
    env: f.env,
    wezterm: fakeWez,
    prober: () => ({ status: 0 }),
    piProber: () => ({ status: 1, stdout: '' }),
  });
  assert.equal(result.ok, false);
  const pi = result.checks.find((c) => c.name === 'pi 命令');
  assert.equal(pi.ok, false);
  assert.match(pi.hint, /安装 pi/);
});

test('WSL openTab omits -d when distro is unknown and passes session file as last arg', async () => {
  let args;
  const result = await openTab({
    wezterm: '/x/wezterm.exe',
    platform: 'wsl',
    distro: undefined,
    cwd: '/tmp/proj',
    sessionFile: '/s/s.jsonl',
    spawner: async (program, a) => { args = a; return { ok: true }; },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(args.slice(0, 6), ['cli', 'spawn', '--domain-name', 'local', '--', 'wsl.exe']);
  assert.equal(args.includes('-d'), false);
  assert.match(args.at(-1), /exec pi --session '\/s\/s\.jsonl'/);
});

test('default spawner (openTab without injection) reports success, failure stderr, and spawn errors', async (t) => {
  const f = fixture(t);
  const ok = join(f.home, 'wez-ok.sh');
  fs.writeFileSync(ok, '#!/bin/sh\necho out\n');
  fs.chmodSync(ok, 0o755);
  assert.deepEqual(await openTab({ wezterm: ok, cwd: '/tmp', sessionFile: '/s.jsonl' }), { ok: true, stdout: 'out' });
  const bad = join(f.home, 'wez-bad.sh');
  fs.writeFileSync(bad, '#!/bin/sh\necho err >&2\nexit 3\n');
  fs.chmodSync(bad, 0o755);
  const failed = await openTab({ wezterm: bad, cwd: '/tmp', sessionFile: '/s.jsonl' });
  assert.equal(failed.ok, false);
  assert.match(failed.error, /err/);
  const missing = await openTab({ wezterm: '/nonexistent/binary-xyz', cwd: '/tmp', sessionFile: '/s.jsonl' });
  assert.equal(missing.ok, false);
  assert.match(missing.error, /ENOENT/);
});

test('default spawner times out when wezterm cli hangs', async (t) => {
  const f = fixture(t);
  const hang = join(f.home, 'wez-hang.sh');
  fs.writeFileSync(hang, '#!/bin/sh\nsleep 30\n');
  fs.chmodSync(hang, 0o755);
  const started = Date.now();
  const result = await openTab({ wezterm: hang, cwd: '/tmp', sessionFile: '/s.jsonl', spawnTimeoutMs: 300 });
  assert.equal(result.ok, false);
  assert.match(result.error, /无响应/);
  assert.ok(Date.now() - started < 5000, '超时必须实际触发而不是永久等待');
});

test('shellQuote round-trips quotes, backticks, dollars, and backslashes through bash', () => {
  assert.equal(shellQuote(''), "''");
  assert.equal(shellQuote('a"b'), "'a\"b'");
  const tricky = "it's `cmd` $HOME \"q\" \\ end";
  const out = spawnSync('bash', ['-c', `printf %s ${shellQuote(tricky)}`], { encoding: 'utf8' });
  assert.equal(out.status, 0, out.stderr);
  assert.equal(out.stdout, tricky);
});

test('listMembers sorts by ts, skips corrupt records, tolerates missing ts and non-json files', (t) => {
  const f = fixture(t);
  writeMember({ sessionId: 'late', ts: 200 }, f.paths);
  writeMember({ sessionId: 'early', ts: 100 }, f.paths);
  fs.writeFileSync(join(f.paths.members, 'no-ts.json'), JSON.stringify({ sessionId: 'no-ts' }));
  fs.writeFileSync(join(f.paths.members, 'bad.json'), '{nope');
  fs.writeFileSync(join(f.paths.members, 'not-json.txt'), 'x');
  const ids = listMembers(f.paths).map((e) => e.sessionId);
  assert.deepEqual(ids.slice(0, 2), ['early', 'late']);
  assert.ok(ids.includes('no-ts'), '缺失 ts 不崩溃');
  assert.equal(ids.includes('bad'), false, '损坏记录跳过');
});

test('writeMember creates member files with 0600 mode', (t) => {
  const f = fixture(t);
  writeMember({ sessionId: 'mode', ts: 1 }, f.paths);
  const mode = fs.statSync(join(f.paths.members, 'mode.json')).mode & 0o777;
  assert.equal(mode, 0o600);
});

test('close intents are cleared by re-registration and member deletion', (t) => {
  const f = fixture(t);
  const entry = closedTabEntry('intent');
  writeMember(entry, f.paths);
  writeCloseIntent(entry, f.paths);
  assert.equal(readCloseIntent('intent', f.paths).paneId, 42);
  writeMember({ ...entry, ts: 2 }, f.paths);
  assert.equal(readCloseIntent('intent', f.paths), undefined);
  writeCloseIntent(entry, f.paths);
  deleteMember('intent', f.paths);
  assert.equal(readCloseIntent('intent', f.paths), undefined);
  writeCloseIntent(entry, f.paths);
  clearWorkspace(f.paths);
  assert.equal(readCloseIntent('intent', f.paths), undefined);
});

test('runRestore reports failure without spawning when every restorable is claimed elsewhere', wslOnly, async (t) => {
  const f = fixture(t);
  const holder = spawn('sleep', ['30'], { stdio: 'ignore' });
  t.after(() => { try { holder.kill('SIGKILL'); } catch {} });
  writeMember({ ...liveEntry(f.paths, 'cl'), ...(await deadIdentity()) }, f.paths);
  claimSession('cl', holder.pid, f.paths);
  fs.writeFileSync(join(f.home, 'wez.exe'), 'MZ');
  let spawned = 0;
  const result = await runRestore({
    env: { ...f.env, PI_WORKSPACE_WEZTERM: join(f.home, 'wez.exe') },
    paths: f.paths,
    noWait: true,
    prober: () => ({ status: 0, stdout: 'w' }),
    piProber: () => ({ status: 0, stdout: 'pi' }),
    spawner: async () => { spawned++; return { ok: true }; },
  });
  assert.equal(spawned, 0, '被占用时不得开标签页');
  assert.equal(result.ok, false);
  assert.equal(result.results[0].state, 'claimed');
  assert.match(summarize(result).join('\n'), /其他恢复进程正在启动，跳过/);
});

test('tab titles prefer the session name, then the cwd basename, and are sanitized', () => {
  assert.equal(tabTitle({ name: 'my-session', cwd: '/work/proj' }), 'my-session');
  assert.equal(tabTitle({ cwd: '/work/proj' }), 'proj');
  assert.equal(tabTitle({ sessionId: 'abc' }), 'abc');
  assert.equal(parsePaneId('42'), 42);
  assert.equal(parsePaneId('pane 7\n'), 7);
  assert.equal(parsePaneId(''), undefined);
  assert.equal(sanitizeTitle('a\nb\tc'), 'a b c');
  assert.equal(sanitizeTitle('   '), undefined);
  assert.equal([...sanitizeTitle('x'.repeat(100))].length, 60);
});

test('otherPanesExist reports other panes and is inconclusive when it cannot tell', () => {
  const list = (panes) => ({ status: 0, stdout: JSON.stringify(panes) });
  assert.equal(otherPanesExist(42, { wezterm: 'w', runner: () => list([{ pane_id: 42 }, { pane_id: 7 }]) }), true);
  assert.equal(otherPanesExist(42, { wezterm: 'w', runner: () => list([{ pane_id: 42 }]) }), false);
  assert.equal(otherPanesExist(42, { wezterm: 'w', runner: () => list([]) }), false);
  assert.equal(otherPanesExist(undefined, { wezterm: 'w', runner: () => list([{ pane_id: 7 }]) }), undefined, '自己的 pane 未知 → 无法判断 → 保留记录');
  assert.equal(otherPanesExist(42, { wezterm: 'w', runner: () => ({ status: 1, stdout: '' }) }), undefined, 'cli 失败 → 无法判断');
  assert.equal(otherPanesExist(42, { wezterm: 'w', runner: () => list([{ pane_id: 42 }, null]) }), false, '坏条目不算其他 pane');
  assert.equal(otherPanesExist(0, { wezterm: 'w', runner: () => list([{ pane_id: 0 }, { pane_id: 7 }]) }), true, 'pane 0 是合法 ID');
  assert.equal(otherPanesExist(0, { wezterm: 'w', runner: () => list([{ pane_id: 0 }, { pane_id: null }]) }), false, 'null 不能被 Number 转成 pane 0');
});

test('pane zero works for environment discovery, client association and titles', async () => {
  assert.equal(currentPaneId({ WEZTERM_PANE: '0' }), 0);
  assert.equal(currentPaneId({ WEZTERM_PANE: '' }), undefined);
  assert.equal(clientPid({ paneId: 0, wezterm: 'w', runner: () => ({ status: 0, stdout: JSON.stringify([{ pid: 123, focused_pane_id: 0 }]) }) }), 123);
  let args;
  assert.equal(setTabTitle({ paneId: 0, title: 'zero', wezterm: 'w', runner: (_program, argv) => { args = argv; return { status: 0 }; } }), true);
  assert.ok(args.includes('--pane-id') && args.includes('0'));
  assert.equal(await setTitle({ stdout: '0\n', entry: { name: 'zero' }, titleSetter: ({ paneId }) => paneId === 0 }), true);
});

test('clientPid associates a pane with its GUI client and stays inconclusive when ambiguous', () => {
  const clients = [{ pid: 123, focused_pane_id: 42 }, { pid: 456, focused_pane_id: 7 }];
  const runner = () => ({ status: 0, stdout: JSON.stringify(clients) });
  assert.equal(clientPid({ paneId: 42, wezterm: 'w', runner }), 123);
  assert.equal(clientPid({ paneId: 7, wezterm: 'w', runner }), 456);
  assert.equal(clientPid({ wezterm: 'w', runner }), undefined, '多客户端且 pane 未知时不能取第一项');
  assert.equal(clientPid({ paneId: 99, wezterm: 'w', runner }), undefined, '后台 pane 无焦点匹配时不能猜测');
  assert.equal(clientPid({ paneId: 42, wezterm: 'w', runner: () => ({ status: 0, stdout: JSON.stringify([{ pid: 123 }]) }) }), 123,
    '单客户端可关联其后台 pane');
  assert.equal(clientPid({ paneId: 42, wezterm: 'w', runner: () => ({ status: 0, stdout: JSON.stringify([{ pid: 123, focused_pane_id: 42 }, { pid: 456, focused_pane_id: 42 }]) }) }), undefined,
    '多个客户端聚焦同一 pane 时身份不明确');
  assert.equal(clientPid({ wezterm: 'w', runner: () => ({ status: 1, stdout: '' }) }), undefined);
  assert.equal(clientPid({ wezterm: 'w', runner: () => ({ status: 0, stdout: '{}' }) }), undefined);
});

test('clientPids returns every valid current client without relying on array order', () => {
  assert.deepEqual(clientPids({ wezterm: 'w', runner: () => ({ status: 0, stdout: JSON.stringify([{ pid: 123 }, { pid: 456 }, { pid: 123 }, null]) }) }), [123, 456]);
  assert.equal(clientPids({ wezterm: 'w', runner: () => ({ status: 0, stdout: '[]' }) }), undefined);
  assert.equal(clientPids({ wezterm: 'w', runner: () => ({ status: 1, stdout: '' }) }), undefined);
});

function closedTabEntry(id, overrides = {}) {
  return { sessionId: id, cwd: '/tmp', sessionFile: `/tmp/${id}.jsonl`, ts: 1,
    pid: 999999, processStart: 'dead', bootId: 'boot-x', paneId: 42, weztermPid: 123, ...overrides };
}

test('WSL reconciliation removes a dead member only when the same GUI confirms its pane is gone', async (t) => {
  const f = fixture(t);
  const entry = closedTabEntry('closed');
  writeMember(entry, f.paths);
  writeCloseIntent(entry, f.paths);
  const members = [entry];
  const deleted = reconcileClosedTabs({
    members, paths: f.paths, env: f.env, platform: 'wsl', wezterm: '/test/wezterm', bootId: 'boot-x',
    clientPidsFn: () => [999, 123],
    listPanesFn: () => [{ pane_id: 0 }],
  });
  assert.equal(deleted, 1, '登记客户端不必是当前客户端数组的第一项');
  assert.equal(members.length, 0);
  assert.equal(listMembers(f.paths).length, 0);
});

test('WSL reconciliation preserves live, old-instance, present-pane and inconclusive records', async (t) => {
  const f = fixture(t);
  const entries = [
    closedTabEntry('old-instance', { weztermPid: 999 }),
    closedTabEntry('present'),
    closedTabEntry('live', { pid: process.pid, processStart: processStart(process.pid) }),
    closedTabEntry('legacy', { paneId: undefined, weztermPid: undefined }),
    closedTabEntry('crashed'),
  ];
  for (const entry of entries) writeMember(entry, f.paths);
  writeCloseIntent(entries.find((entry) => entry.sessionId === 'present'), f.paths);
  const members = [...entries];
  let paneQueries = 0;
  const deleted = reconcileClosedTabs({
    members, paths: f.paths, env: f.env, platform: 'wsl', wezterm: '/test/wezterm', bootId: 'boot-x',
    clientPidsFn: () => [123],
    listPanesFn: () => { paneQueries++; return [{ pane_id: 42 }, { pane_id: 7 }]; },
  });
  assert.equal(deleted, 0);
  assert.equal(paneQueries, 1, '只需为同实例的死亡记录查询 pane');
  assert.equal(listMembers(f.paths).length, 5);

  const failed = closedTabEntry('failed');
  writeMember(failed, f.paths);
  writeCloseIntent(failed, f.paths);
  assert.equal(reconcileClosedTabs({
    members: [failed], paths: f.paths, env: f.env, platform: 'wsl', wezterm: '/test/wezterm', bootId: 'boot-x',
    clientPidsFn: () => [123], listPanesFn: () => undefined,
  }), 0);
  assert.ok(listMembers(f.paths).some((entry) => entry.sessionId === 'failed'));

  const disabled = closedTabEntry('disabled');
  writeMember(disabled, f.paths);
  writeCloseIntent(disabled, f.paths);
  assert.equal(reconcileClosedTabs({
    members: [disabled], paths: f.paths, env: { ...f.env, PI_REOPEN_FORGET_ON_TAB_CLOSE: '0' },
    platform: 'wsl', wezterm: '/test/wezterm', bootId: 'boot-x',
    clientPidsFn: () => { throw new Error('禁用时不应查询'); },
  }), 0);
  assert.ok(listMembers(f.paths).some((entry) => entry.sessionId === 'disabled'));
});

test('WSL reconciliation does not delete a session that was registered again during inspection', async (t) => {
  const f = fixture(t);
  const original = closedTabEntry('reopened');
  writeMember(original, f.paths);
  writeCloseIntent(original, f.paths);
  const replacement = { ...original, ts: 2, pid: process.pid, processStart: processStart(process.pid), paneId: 99 };
  assert.equal(reconcileClosedTabs({
    members: [original], paths: f.paths, env: f.env, platform: 'wsl', wezterm: '/test/wezterm', bootId: 'boot-x',
    clientPidsFn: () => [123],
    listPanesFn: () => { writeMember(replacement, f.paths); return [{ pane_id: 7 }]; },
  }), 0);
  const current = listMembers(f.paths).find((entry) => entry.sessionId === 'reopened');
  assert.equal(current.ts, 2);
  assert.equal(current.paneId, 99);
});

test('restore sets a tab title from the spawn pane id', async (t) => {
  const f = fixture(t);
  const named = { ...liveEntry(f.paths, 'named', { name: 'my-session' }), ...(await deadIdentity()) };
  const unnamed = { ...liveEntry(f.paths, 'unnamed', { name: undefined }), ...(await deadIdentity()) };
  writeMember(named, f.paths);
  writeMember(unnamed, f.paths);
  fs.writeFileSync(join(f.home, 'wez.exe'), 'MZ');
  const titles = [];
  const result = await runRestore({
    env: { HOME: f.home, PI_WORKSPACE_WEZTERM: join(f.home, 'wez.exe') },
    platform: 'linux',
    paths: f.paths,
    noWait: true,
    owners: new Map(),
    prober: () => ({ status: 0, stdout: 'wezterm 1.0' }),
    piProber: () => ({ status: 0, stdout: '/usr/bin/pi' }),
    spawner: async () => ({ ok: true, stdout: '77' }),
    titleSetter: (args) => { titles.push(args); return true; },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(titles.map((call) => call.title), ['my-session', 'agent']);
  assert.deepEqual(titles.map((call) => call.paneId), [77, 77]);
});

test('restore honors --limit', async (t) => {
  const f = fixture(t);
  for (const id of ['a1', 'b2', 'c3']) {
    writeMember({ ...liveEntry(f.paths, id), ...(await deadIdentity()) }, f.paths);
  }
  fs.writeFileSync(join(f.home, 'wez.exe'), 'MZ');
  const spawned = [];
  const base = {
    env: { HOME: f.home, PI_WORKSPACE_WEZTERM: join(f.home, 'wez.exe') },
    platform: 'linux',
    paths: f.paths,
    noWait: true,
    owners: new Map(),
    prober: () => ({ status: 0, stdout: 'wezterm 1.0' }),
    piProber: () => ({ status: 0, stdout: '/usr/bin/pi' }),
    spawner: async (_program, args) => { spawned.push(args); return { ok: true, stdout: '1' }; },
    titleSetter: () => true,
  };
  const limited = await runRestore({ ...base, limit: 2 });
  assert.equal(spawned.length, 2, '--limit 必须限制本次开出的标签页数量');
  assert.equal(limited.plan.count('deferred'), 1);
  assert.equal(exitCodeFor(limited), EXIT.skipped);
  assert.match(summarize(limited).join('\n'), /超出 --limit/);
});

test('restore opens tabs with bounded concurrency', async (t) => {
  const f = fixture(t);
  for (let i = 0; i < 8; i++) {
    writeMember({ ...liveEntry(f.paths, `s${i}`), ...(await deadIdentity()) }, f.paths);
  }
  fs.writeFileSync(join(f.home, 'wez.exe'), 'MZ');
  let inFlight = 0;
  let maxInFlight = 0;
  const result = await runRestore({
    env: { HOME: f.home, PI_WORKSPACE_WEZTERM: join(f.home, 'wez.exe') },
    platform: 'linux',
    paths: f.paths,
    noWait: true,
    owners: new Map(),
    prober: () => ({ status: 0, stdout: 'wezterm 1.0' }),
    piProber: () => ({ status: 0, stdout: '/usr/bin/pi' }),
    spawner: async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 10));
      inFlight--;
      return { ok: true, stdout: '1' };
    },
    titleSetter: () => true,
  });
  assert.equal(result.ok, true);
  assert.equal(result.results.filter((r) => r.requested).length, 8);
  assert.equal(maxInFlight, 5, '默认并发上限为 5');
});

test('default verification window scales with the batch size', () => {
  assert.equal(defaultWaitTimeoutMs(0), 15_000);
  assert.equal(defaultWaitTimeoutMs(10), 35_000);
  assert.equal(defaultWaitTimeoutMs(100), 90_000, '窗口有上限，避免无限等待');
});

test('registry health detects a missing extension record and version drift', async (t) => {
  const { healthChecks, registryHealth, writeExtensionRecord } = await import('../src/health.js');
  const f = fixture(t);
  const empty = registryHealth({ paths: f.paths, env: { ...f.env } });
  assert.equal(empty.dirExists, false);
  let checks = healthChecks(empty, 'en');
  assert.equal(checks.find((c) => c.name === 'Registry directory').ok, false);
  assert.equal(checks.find((c) => c.name === 'Extension running').ok, false);

  writeMember({ ...liveEntry(f.paths, 'health-entry'), pid: undefined }, f.paths);
  writeExtensionRecord({ version: '0.0.1', ts: Date.now() }, f.paths);
  const healthy = registryHealth({ paths: f.paths, env: { ...f.env } });
  assert.equal(healthy.dirExists, true);
  assert.equal(healthy.writable, true);
  assert.equal(healthy.memberCount, 1);
  assert.ok(healthy.lastRegisteredAt);
  checks = healthChecks(healthy, 'en');
  const versionCheck = checks.find((c) => c.name === 'Version match');
  assert.equal(versionCheck.ok, false, 'CLI 与扩展版本不一致必须暴露出来');
  assert.match(versionCheck.hint, /differ/);

  writeExtensionRecord({ version: '0.0.1', schemaVersion: 99 }, f.paths);
  const future = healthChecks(registryHealth({ paths: f.paths, env: { ...f.env } }), 'en');
  assert.equal(future.find((c) => c.name === 'Record schema').ok, false, '扩展写出更新的记录结构必须告警');

});

test('extension health distinguishes a historical record from a live recorded process', async (t) => {
  const { healthChecks, registryHealth, writeExtensionRecord } = await import('../src/health.js');
  const f = fixture(t);
  writeExtensionRecord({ version: '1.0.0', pid: 123, processStart: 'start-a', bootId: 'boot-a', ts: Date.now() }, f.paths);
  const stale = registryHealth({ paths: f.paths, env: f.env, bootId: 'boot-a', processStart: () => 'start-b' });
  assert.equal(stale.extensionRunning, false, 'PID 被复用时进程启动身份不同，不得判定为仍在运行');
  const staleCheck = healthChecks(stale, 'en').find((c) => c.name === 'Extension running');
  assert.equal(staleCheck.ok, false);
  assert.match(staleCheck.detail, /historical record only/);
  const live = registryHealth({ paths: f.paths, env: f.env, bootId: 'boot-a', processStart: () => 'start-a' });
  assert.equal(live.extensionRunning, true);
  assert.equal(healthChecks(live, 'en').find((c) => c.name === 'Extension running').ok, true);
});

test('WSL single-tab close detection is explicit and remains a non-blocking warning', async () => {
  const { singleTabCloseCheck } = await import('../src/health.js');
  const missing = singleTabCloseCheck({ env: {}, platform: 'wsl', lang: 'en' });
  assert.equal(missing.ok, false);
  assert.equal(missing.warning, true);
  assert.match(missing.detail, /always keeps its record/);
  assert.match(missing.hint, /WSLENV/);
  assert.match(missing.hint, /setx/);
  const available = singleTabCloseCheck({ env: { WEZTERM_PANE: '42' }, platform: 'wsl', lang: 'en' });
  assert.equal(available.ok, true);
  assert.match(available.detail, /42/);
  const disabled = singleTabCloseCheck({ env: { WEZTERM_PANE: '42', PI_REOPEN_FORGET_ON_TAB_CLOSE: '0' }, platform: 'wsl', lang: 'en' });
  assert.match(disabled.detail, /disabled/);
  assert.equal(singleTabCloseCheck({ env: {}, platform: 'linux', lang: 'en' }), undefined);
});

test('records with a newer schema are skipped and reported by list', async (t) => {
  const f = fixture(t);
  writeMember({ ...liveEntry(f.paths, 'current-schema'), pid: undefined }, f.paths);
  fs.writeFileSync(join(f.paths.members, 'future.json'),
    JSON.stringify({ sessionId: 'future', schemaVersion: 99, ts: Date.now() }));
  const inspected = inspect({ paths: f.paths, owners: new Map() });
  assert.equal(inspected.unsupported, 1);
  assert.equal(inspected.plan.items.length, 1, '未来版本的记录不参与恢复');
  const out = [];
  const stdout = { write: (line) => out.push(line), on: () => {}, columns: 200 };
  await cliRun(['list'], { stdout, env: { ...f.env, PI_CODING_AGENT_DIR: f.paths.agent } });
  assert.match(out.join('\n'), /结构版本比当前 CLI 新/);
});

test('workspace paths use the pi-reopen name and still expose legacy locations', async (t) => {
  const { workspacePaths } = await import('../src/paths.js');
  const paths = workspacePaths({ HOME: '/home/u' });
  assert.equal(paths.workspace, '/home/u/.pi/agent/pi-reopen');
  assert.equal(paths.members, '/home/u/.pi/agent/pi-reopen/members');
  assert.equal(paths.legacyMembers, '/home/u/.pi/agent/pi-workspace/members');
});

test('envCompat prefers the canonical name and still honors the legacy one', async (t) => {
  const { envCompat, legacyEnvName } = await import('../src/env.js');
  assert.equal(legacyEnvName('PI_REOPEN_WEZTERM'), 'PI_WORKSPACE_WEZTERM');
  assert.equal(envCompat({ PI_REOPEN_WEZTERM: '/a', PI_WORKSPACE_WEZTERM: '/b' }, 'PI_REOPEN_WEZTERM'), '/a');
  assert.equal(envCompat({ PI_WORKSPACE_WEZTERM: '/b' }, 'PI_REOPEN_WEZTERM'), '/b');
  assert.equal(envCompat({}, 'PI_REOPEN_WEZTERM'), undefined);
});

test('members from the legacy directory are merged, canonical records win', async (t) => {
  const f = fixture(t);
  fs.mkdirSync(f.paths.legacyMembers, { recursive: true });
  const legacyEntry = { sessionId: 'legacy', cwd: f.paths.agent, sessionFile: join(f.paths.sessions, 'x.jsonl'), ts: 1 };
  fs.writeFileSync(join(f.paths.legacyMembers, 'legacy.json'), JSON.stringify(legacyEntry));
  fs.writeFileSync(join(f.paths.legacyMembers, 'dup.json'), JSON.stringify({ ...legacyEntry, sessionId: 'dup', ts: 2, name: 'old' }));
  writeMember({ ...liveEntry(f.paths, 'dup'), pid: undefined, name: 'new' }, f.paths);
  const { readMembers } = await import('../src/members.js');
  const { members } = readMembers(f.paths);
  const byId = Object.fromEntries(members.map((m) => [m.sessionId, m]));
  assert.equal(byId['legacy']?.ts, 1, '旧目录记录必须仍可读取');
  assert.equal(byId['dup']?.name, 'new', '同一 sessionId 以新目录为准');
  deleteMember('legacy', f.paths);
  assert.equal(fs.existsSync(join(f.paths.legacyMembers, 'legacy.json')), false, '删除必须同时清理旧目录');
});

test('terminal adapters are resolved by name and unknown ones fail closed', async (t) => {
  const { getTerminal, listTerminals, terminalId } = await import('../src/terminals/index.js');
  assert.deepEqual(listTerminals(), ['wezterm']);
  assert.equal(getTerminal('wezterm')?.id, 'wezterm');
  assert.equal(getTerminal('tmux'), undefined);
  assert.equal(terminalId({ PI_WORKSPACE_TERMINAL: 'tmux' }), 'tmux');
  assert.equal(terminalId({}), 'wezterm');

  const f = fixture(t);
  const pre = preflight({
    env: { ...f.env, PI_WORKSPACE_TERMINAL: 'tmux' },
    platform: 'linux',
    piProber: () => ({ status: 0, stdout: '/usr/bin/pi' }),
  });
  assert.equal(pre.ok, false, '未知适配器必须拒绝恢复');
  const failed = pre.checks.find((c) => c.name === '终端适配器');
  assert.equal(failed.ok, false);
  assert.match(failed.hint, /wezterm/);
});

test('peer dependencies require a minimum Pi version without an upper bound', () => {
  const pkg = JSON.parse(fs.readFileSync(join(project, 'package.json'), 'utf8'));
  for (const [name, range] of Object.entries(pkg.peerDependencies)) {
    assert.match(range, /^>=/, `${name} 必须声明最低支持版本`);
    assert.doesNotMatch(range, /<\d/, `${name} 不应限制主版本，以便跟随最新 Pi`);
  }
});


test('doctor reports registry health and explains an empty restore', async (t) => {
  const f = fixture(t);
  const out = [];
  const stdout = { write: (line) => out.push(line), on: () => {}, columns: 200 };
  // 预检需要可执行的 WezTerm 与 pi；用脚本夹具让本用例与真实环境无关。
  const bin = join(f.home, 'bin');
  fs.mkdirSync(bin, { recursive: true });
  const wez = join(bin, 'wezterm');
  fs.writeFileSync(wez, '#!/bin/sh\nif [ "$1" = "--version" ]; then echo "wezterm 1.0"; exit 0; fi\necho "[]"\n');
  fs.chmodSync(wez, 0o755);
  const piPath = join(bin, 'pi');
  fs.writeFileSync(piPath, '#!/bin/sh\nexit 0\n');
  fs.chmodSync(piPath, 0o755);
  const env = {
    HOME: f.home,
    PATH: `${bin}:/usr/bin:/bin`,
    PI_WORKSPACE_LANG: 'zh',
    PI_CODING_AGENT_DIR: f.paths.agent,
    PI_WORKSPACE_WEZTERM: wez,
    PI_WORKSPACE_PI_BIN: piPath,
  };
  // WSL 上预检要求发行版名；普通 Linux CI 不设置（否则会被判成 WSL 而缺少 /run/WSL）。
  if (fs.existsSync('/run/WSL')) env.WSL_DISTRO_NAME = 'Arch';
  const code = await cliRun(['doctor'], { stdout, env });
  assert.equal(code, 2, '扩展未加载时 doctor 必须失败，而不是显示“环境就绪”');
  assert.match(out.join('\n'), /登记目录/);
  assert.match(out.join('\n'), /扩展运行状态/);
  out.length = 0;
  assert.equal(await cliRun(['restore', '--dry-run'], { stdout, env }), 0);
  assert.match(out.join('\n'), /待恢复 0 个/);
  assert.match(out.join('\n'), /\/reload/, '空登记时必须给出“刚安装”的下一步');
});

test('i18n: language follows the environment and reports localize', async (t) => {
  const { resolveLang, t: translate } = await import('../src/i18n.js');
  assert.equal(resolveLang({ PI_WORKSPACE_LANG: 'en' }), 'en');
  assert.equal(resolveLang({ PI_WORKSPACE_LANG: 'zh-CN' }), 'zh');
  assert.equal(resolveLang({ LANG: 'zh_CN.UTF-8' }), 'zh');
  assert.equal(resolveLang({ LANG: 'C.UTF-8' }), 'en', '非中文 locale 默认英文');
  assert.equal(translate('en', 'state.live'), 'running');
  assert.equal(translate('zh', 'state.live'), '运行中');
  assert.equal(translate('en', 'restore.processed', { n: 2, skipped: '', aborted: '' }), 'Processed 2');
  assert.equal(label('restorable', 'en'), 'pending restore');

  const f = fixture(t);
  const entry = { ...liveEntry(f.paths, 'i18n-entry'), ...(await deadIdentity()) };
  writeMember(entry, f.paths);
  const plan = buildRestorePlan({ members: [entry], paths: f.paths, liveFn: () => false, bootId: currentBootId() });
  const lines = summarize({
    ok: true,
    stage: 'done',
    plan,
    results: [{ ...plan.items[0], requested: true }],
    verification: { verified: ['i18n-entry'], unverified: [] },
  }, 'en');
  assert.match(lines.join('\n'), /started and confirmed/);
  assert.doesNotMatch(lines.join('\n'), /已启动并确认/);

  const out = [];
  const stdout = { write: (line) => out.push(line), on: () => {}, columns: 200 };
  await cliRun(['--help'], { stdout, env: { PI_WORKSPACE_LANG: 'en' } });
  assert.match(out.join('\n'), /^pi-reopen — reopen the Pi sessions/);
  assert.match(out.join('\n'), /Exit codes/);
});

test('CLI entry conventions: --help and --version succeed instead of printing usage', async (t) => {
  const out = [];
  const stdout = { write: (line) => out.push(line), on: () => {}, columns: 200 };
  assert.equal(await cliRun(['--help'], { stdout, env: {} }), 0);
  assert.match(out.join('\n'), /--only/);
  out.length = 0;
  assert.equal(await cliRun(['--version'], { stdout, env: {} }), 0);
  assert.match(out.join('\n'), /^pi-reopen \d+\.\d+\.\d+/);
  out.length = 0;
  assert.equal(await cliRun(['help'], { stdout, env: {} }), 0);
  assert.equal(await cliRun(['-h'], { stdout, env: {} }), 0);
});

test('bare flags normalize to restore, and --only patterns are collected', () => {
  assert.deepEqual(normalizeArgv([]), { command: 'restore', flags: [] });
  assert.deepEqual(normalizeArgv(['--dry-run']), { command: 'restore', flags: ['--dry-run'] });
  assert.deepEqual(normalizeArgv(['list', '--wide']), { command: 'list', flags: ['--wide'] });
  assert.deepEqual(normalizeArgv(['-h']), { command: 'help', flags: [] });
  assert.deepEqual(normalizeArgv(['version']), { command: 'version', flags: [] });
  assert.deepEqual(collectOnly(['--only', 'a,b', '--only=c']), ['a', 'b', 'c']);
  assert.deepEqual(collectOnly(['--only']), []);
});

test('--only matches names, paths and globs and marks the rest filtered', (t) => {
  assert.equal(matchesOnly({ name: 'api-refactor', cwd: '/w/a' }, 'refactor'), true);
  assert.equal(matchesOnly({ name: 'x', cwd: '/w/shop' }, 'SHOP'), true);
  assert.equal(matchesOnly({ name: 'x', cwd: '/w/shop' }, 'web*'), false);
  assert.equal(matchesOnly({ name: 'web-shop', cwd: '/w/shop' }, 'web*'), true);
  const f = fixture(t);
  writeMember({ ...liveEntry(f.paths, 'keep'), pid: undefined, name: 'api-refactor' }, f.paths);
  writeMember({ ...liveEntry(f.paths, 'drop'), pid: undefined, name: 'web-shop' }, f.paths);
  const { plan } = inspect({ paths: f.paths, owners: new Map(), platform: 'wsl', distro: 'Arch', only: ['refactor'] });
  const byId = Object.fromEntries(plan.items.map((i) => [i.entry.sessionId, i.state]));
  assert.equal(byId['keep'], 'restorable');
  assert.equal(byId['drop'], 'filtered');
});

test('list --json and restore --json emit machine-readable payloads', async (t) => {
  const f = fixture(t);
  writeMember({ ...liveEntry(f.paths, 'json-entry'), pid: undefined }, f.paths);
  const out = [];
  const stdout = { write: (line) => out.push(line), on: () => {}, columns: 200 };
  const env = { ...f.env, PI_CODING_AGENT_DIR: f.paths.agent };
  assert.equal(await cliRun(['list', '--json'], { stdout, env }), 0);
  const list = JSON.parse(out.join('\n'));
  assert.equal(list.members[0].sessionId, 'json-entry');
  assert.equal(list.members[0].state, 'restorable');
  out.length = 0;
  const broken = { ...env, PI_WORKSPACE_WEZTERM: join(f.home, 'missing-wezterm') };
  const code = await cliRun(['restore', '--dry-run', '--json'], { stdout, env: broken });
  assert.equal(code, 2);
  const payload = JSON.parse(out.join('\n'));
  assert.equal(payload.stage, 'preflight');
  assert.equal(payload.exitCode, 2);
  assert.ok(payload.checks.some((check) => !check.ok));
  assert.deepEqual(jsonPayload({ stage: 'done', ok: true, results: [] }, 0).results, []);
});

test('records older than the max age are expired, not restorable', (t) => {
  const f = fixture(t);
  const now = Date.now();
  const old = { ...liveEntry(f.paths, 'old'), pid: undefined, ts: now - 20 * 86_400_000 };
  const fresh = { ...liveEntry(f.paths, 'fresh'), pid: undefined };
  writeMember(old, f.paths);
  writeMember(fresh, f.paths);
  const { plan } = inspect({ paths: f.paths, owners: new Map(), platform: 'wsl', distro: 'Arch', now });
  const byId = Object.fromEntries(plan.items.map((i) => [i.entry.sessionId, i.state]));
  assert.equal(byId['old'], 'expired', '两周前的被动死亡记录不应再自动恢复');
  assert.equal(byId['fresh'], 'restorable');
});

test('prune removes expired and unrecoverable records, keeps live and foreign ones', (t) => {
  const f = fixture(t);
  const now = Date.now();
  const expired = { ...liveEntry(f.paths, 'expired'), pid: undefined, ts: now - 20 * 86_400_000 };
  const goneCwd = { ...liveEntry(f.paths, 'gone-cwd'), pid: undefined, cwd: join(f.home, 'nope') };
  const goneFile = { ...liveEntry(f.paths, 'gone-file'), pid: undefined };
  fs.rmSync(goneFile.sessionFile);
  const live = { ...liveEntry(f.paths, 'live'), pid: process.pid, processStart: processStart(process.pid), bootId: currentBootId() };
  const foreign = { ...liveEntry(f.paths, 'foreign'), pid: undefined, platform: 'win32' };
  for (const entry of [expired, goneCwd, goneFile, live, foreign]) writeMember(entry, f.paths);
  const result = pruneMembers({ paths: f.paths, now, maxAgeMs: 14 * 86_400_000, platform: 'wsl', distro: 'Arch', owners: new Map() });
  assert.deepEqual(result.removed.map((e) => e.sessionId).sort(), ['expired', 'gone-cwd', 'gone-file']);
  assert.equal(result.kept, 2);
  assert.ok(fs.existsSync(join(f.paths.members, 'live.json')), '存活记录不得清理');
  assert.ok(fs.existsSync(join(f.paths.members, 'foreign.json')), '其他平台的记录不得清理');
});

test('forget resolves unique prefixes and rejects ambiguous ones', (t) => {
  const f = fixture(t);
  for (const id of ['aaa1', 'aaa2', 'bbb3']) writeMember({ ...liveEntry(f.paths, id), pid: undefined }, f.paths);
  const ambiguous = resolveMemberIds(['aaa'], f.paths);
  assert.deepEqual(ambiguous.ambiguous.map((item) => item.input), ['aaa']);
  const unique = resolveMemberIds(['bbb'], f.paths);
  assert.deepEqual(unique.ids, ['bbb3']);
  assert.equal(forgetMembers(unique.ids, f.paths), 1);
  assert.equal(fs.existsSync(join(f.paths.members, 'bbb3.json')), false);
  assert.deepEqual(resolveMemberIds(['zzz'], f.paths).missing, ['zzz']);
});

test('cli forget and prune are scriptable', async (t) => {
  const f = fixture(t);
  const expired = { ...liveEntry(f.paths, 'old'), pid: undefined, ts: Date.now() - 20 * 86_400_000 };
  const fresh = { ...liveEntry(f.paths, 'fresh'), pid: undefined };
  writeMember(expired, f.paths);
  writeMember(fresh, f.paths);
  const out = [];
  const stdout = { write: (line) => out.push(line), on: () => {}, columns: 200 };
  const env = { ...f.env, PI_CODING_AGENT_DIR: f.paths.agent };
  assert.equal(await cliRun(['prune', '--dry-run'], { stdout, env }), 0);
  assert.match(out.join('\n'), /\[dry-run\] 将清理 1 条/);
  assert.ok(fs.existsSync(join(f.paths.members, 'old.json')), '--dry-run 不得删除');
  assert.equal(await cliRun(['forget', 'fresh'], { stdout, env }), 0);
  assert.match(out.join('\n'), /已移除 1 条/);
  assert.equal(fs.existsSync(join(f.paths.members, 'fresh.json')), false);
  assert.equal(await cliRun(['forget'], { stdout, env }), 1, '缺少参数应返回用法错误');
});

test('exit codes separate failures, unverified starts and skipped work', () => {
  assert.equal(exitCodeFor({ stage: 'preflight' }), EXIT.preflight);
  assert.equal(exitCodeFor({ stage: 'locked' }), EXIT.skipped);
  assert.equal(exitCodeFor({ stage: 'dry-run' }), EXIT.ok);
  assert.equal(exitCodeFor({ stage: 'done', results: [] }), EXIT.ok, '没有待恢复项不算失败');
  assert.equal(exitCodeFor({ stage: 'done', results: [{ requested: true }], verification: { verified: ['a'], unverified: [] } }), EXIT.ok);
  assert.equal(exitCodeFor({ stage: 'done', results: [{ requested: true }], verification: { verified: [], unverified: ['a'] } }), EXIT.unverified,
    '请求已发出但未确认必须与完全成功区分');
  assert.equal(exitCodeFor({ stage: 'done', results: [{ requested: true }, { state: 'claimed' }], verification: { verified: ['a'], unverified: [] } }), EXIT.skipped);
  assert.equal(exitCodeFor({ stage: 'done', results: [{ requested: false }], verification: null }), EXIT.failed);
  assert.equal(exitCodeFor({ stage: 'done', results: [{ requested: false }, { requested: true }], verification: { verified: [], unverified: ['b'] } }), EXIT.failed,
    '真实失败优先于未确认');
});

test('summarize handles empty restore results', () => {
  const result = { ok: true, stage: 'done', plan: { items: [], restorable: [], count: () => 0 }, results: [], verification: null };
  assert.match(summarize(result).join('\n'), /没有待恢复的会话/);
});

test('cli.run: no args runs restore, unknown command prints usage and exits 1', async (t) => {
  const f = fixture(t);
  const env = { ...f.env, PI_WORKSPACE_WEZTERM: join(f.home, 'missing-wezterm.exe') };
  let out = '';
  const code = await cliRun([], { stdout: { write: (l) => (out += l) }, env });
  assert.equal(code, 2, '隔离环境预检不通过，不得开标签页');
  assert.match(out, /环境预检未通过/);
  out = '';
  const bogus = await cliRun(['bogus'], { stdout: { write: (l) => (out += l) }, env });
  assert.equal(bogus, 1);
  assert.match(out, /pi-reopen —/);
  assert.match(out, /--dry-run/);
});

test('cli list reads the isolated agent dir', async (t) => {
  const f = fixture(t);
  const old = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = f.paths.agent;
  t.after(() => { if (old === undefined) delete process.env.PI_CODING_AGENT_DIR; else process.env.PI_CODING_AGENT_DIR = old; });
  writeMember(liveEntry(f.paths, 'cli-list', { pid: undefined, processStart: undefined, bootId: undefined }), f.paths);
  let out = '';
  const code = await cliRun(['list'], { stdout: { write: (l) => (out += l), columns: 120 }, env: f.env });
  assert.equal(code, 0);
  assert.match(out, /cli-list/);
  assert.match(out, /待恢复/);
});

test('cli list aligns CJK columns and truncates long paths to terminal width', async (t) => {
  const f = fixture(t);
  const old = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = f.paths.agent;
  t.after(() => { if (old === undefined) delete process.env.PI_CODING_AGENT_DIR; else process.env.PI_CODING_AGENT_DIR = old; });
  const longCwd = '/mnt/d/work/NB/10-教案/2026年秋季/四个班级_前三课及教学进度表/一个相当长的子目录名称';
  writeMember(liveEntry(f.paths, 'align-a', { pid: undefined, processStart: undefined, bootId: undefined, cwd: longCwd }), f.paths);
  writeMember({ ...liveEntry(f.paths, 'align-b', { pid: undefined, processStart: undefined, bootId: undefined }), sessionFile: '/nonexistent/nope.jsonl' }, f.paths);
  let out = '';
  const stdout = { write: (l) => (out += l), columns: 100 };
  const code = await cliRun(['list'], { stdout, env: f.env });
  assert.equal(code, 0);
  const lines = out.trim().split('\n');
  assert.match(lines[0], /^#/, '表头首列为序号');
  assert.match(lines[0], /状态/);
  assert.match(lines[0], /会话/);
  assert.match(lines[0], /路径/);
  assert.match(lines[0], /时间/);
  const data = lines.slice(1, 3);
  assert.equal(data.length, 2);
  assert.equal(data[0].slice(0, 1), '1', '行首为序号 1');
  assert.equal(data[1].slice(0, 1), '2', '行首为序号 2');
  const sepPos = (line) => displayWidth(line.slice(0, line.indexOf(' | ')));
  assert.equal(sepPos(data[0]), sepPos(data[1]), '状态列（待恢复/会话文件缺失等）按显示宽度对齐');
  for (const l of lines) assert.ok(displayWidth(l) <= 100, `每行不超过终端宽度：${l}`);
  assert.match(out, /…/, '超长路径应被截断');
  assert.doesNotMatch(out, /相当长的子目录名称/);
  // --wide 不截断
  out = '';
  await cliRun(['list', '--wide'], { stdout, env: f.env });
  assert.match(out, /相当长的子目录名称/);
  assert.doesNotMatch(out, /…/);
  // 窄终端放不下表格时退回未对齐的简单行
  out = '';
  await cliRun(['list'], { stdout: { write: (l) => (out += l), columns: 40 }, env: f.env });
  const narrow = out.trim().split('\n');
  assert.equal(narrow.length, 3, '窄终端：每个成员一行，无表头，末尾为快照提示');
  for (const l of narrow.slice(0, 2)) assert.match(l, / \| /);
  // 无 stdout.columns 时回退到 COLUMNS 环境变量
  out = '';
  await cliRun(['list'], { stdout: { write: (l) => (out += l) }, env: { ...f.env, COLUMNS: '40' } });
  assert.equal(out.trim().split('\n').length, 3, 'COLUMNS 环境变量同样触发窄终端回退');
});

test('cli clear empties the isolated workspace and keeps session files', async (t) => {
  const f = fixture(t);
  const old = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = f.paths.agent;
  t.after(() => { if (old === undefined) delete process.env.PI_CODING_AGENT_DIR; else process.env.PI_CODING_AGENT_DIR = old; });
  writeMember(liveEntry(f.paths, 'to-clear'), f.paths);
  let out = '';
  const code = await cliRun(['clear'], { stdout: { write: (l) => (out += l) }, env: f.env });
  assert.equal(code, 0);
  assert.match(out, /已清空 1 条/);
  assert.equal(listMembers(f.paths).length, 0);
  assert.ok(fs.existsSync(liveEntry(f.paths, 'to-clear').sessionFile), '对话文件不受影响');
});
