import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join, win32 } from 'node:path';
import test from 'node:test';
import { runtimePlatform, powershellArgs, powershellPath } from '../src/platform.js';
import { discoverWezterm } from '../src/discover.js';
import { discoverWindowsPi, buildWindowsScript, powershellQuote } from '../src/windows.js';
import { currentBootId, processStart, isLive } from '../src/liveness.js';
import { preflight } from '../src/preflight.js';
import { openTab } from '../src/spawn.js';
import { runRestore } from '../src/restore.js';
import { workspacePaths } from '../src/paths.js';
import { writeMember } from '../src/members.js';
import { acquireRestoreLock, claimSession, releaseRestoreLock } from '../src/claims.js';

function fixture(t) {
  const root = fs.mkdtempSync(join(tmpdir(), 'pi-platform-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

const nativePlatform = process.platform;

test('platform selection keeps native Windows/macOS separate from inherited WSL variables', () => {
  assert.equal(runtimePlatform({ WSL_DISTRO_NAME: 'Arch' }, 'linux'), 'wsl');
  assert.equal(runtimePlatform({ WSL_INTEROP: '/run/WSL/1_interop' }, 'linux'), 'wsl');
  assert.equal(runtimePlatform({ WSL_DISTRO_NAME: 'Arch' }, 'win32'), 'win32');
  assert.equal(runtimePlatform({}, 'darwin'), 'darwin');
  assert.equal(runtimePlatform({}, 'freebsd'), 'freebsd');
});

for (const [platform, env, expected] of [
  ['linux', { PATH: '/custom:/usr/bin' }, '/custom/wezterm'],
  ['darwin', { PATH: '' }, '/Applications/WezTerm.app/Contents/MacOS/wezterm'],
  ['win32', { Path: 'C:\\Tools;C:\\Other' }, 'C:\\Tools\\wezterm.exe'],
  ['win32', { ProgramFiles: 'D:\\Program Files' }, 'D:\\Program Files\\WezTerm\\wezterm.exe'],
]) {
  test(`WezTerm discovery: ${platform} ${expected}`, () => {
    const deps = { platform, isFile: p => p === expected, execFile: () => { throw new Error('must not run WSL discovery'); } };
    assert.equal(discoverWezterm(env, deps), expected);
    assert.equal(discoverWezterm({ ...env, PI_WORKSPACE_WEZTERM: 'missing' }, deps), undefined);
  });
}

test('Windows npm shim resolves package bin and Node without executing a .cmd shell', () => {
  const prefix = "C:\\Users\\O'Brien & Co\\npm";
  const shim = win32.join(prefix, 'pi.cmd');
  const root = win32.join(prefix, 'node_modules', '@earendil-works', 'pi-coding-agent');
  const entry = win32.join(root, 'dist', 'cli.js');
  const node = 'C:\\Program Files\\nodejs\\node.exe';
  const deps = {
    isFile: p => [shim, entry, node].includes(p), nodePath: node,
    readFile: p => {
      assert.equal(p, win32.join(root, 'package.json'));
      return JSON.stringify({ name: '@earendil-works/pi-coding-agent', bin: { pi: './dist/cli.js' } });
    },
  };
  assert.deepEqual(discoverWindowsPi({ Path: prefix }, deps), { piBin: shim, piCommand: [node, entry] });
  assert.deepEqual(discoverWindowsPi({ PI_WORKSPACE_PI_BIN: entry }, deps)?.piCommand, [node, entry]);
  for (const value of ['pi', `${shim} --flag`, 'C:\\missing.cmd']) {
    assert.equal(discoverWindowsPi({ Path: prefix, PI_WORKSPACE_PI_BIN: value }, deps), undefined);
  }
  assert.equal(discoverWindowsPi({ Path: prefix }, { ...deps, readFile: () => '{}' }), undefined);
});

test('native liveness probes parse stable boot/process identities and reject missing processes', () => {
  const mac = { platform: 'darwin', execFile: (program, args, opts) => {
    assert.equal(opts.env.LC_ALL, 'C');
    return program.endsWith('sysctl') ? '{ sec = 12345, usec = 678 } Sun Nov 1' : 'S Mon Nov  2 12:30:00 2026\n';
  } };
  assert.equal(currentBootId(undefined, mac), 'darwin:12345:678');
  assert.equal(processStart(42, undefined, mac), 'Mon Nov 2 12:30:00 2026');
  assert.equal(processStart(42, undefined, { ...mac, execFile: () => 'Z Mon Nov 2 12:30:00 2026' }), undefined);
  const windows = { platform: 'win32', execFile: (program, args) => {
    assert.ok(program.endsWith('powershell.exe'));
    assert.equal(args.at(-2), '-EncodedCommand');
    assert.match(Buffer.from(args.at(-1), 'base64').toString('utf16le'), /ToUniversalTime\(\).Ticks/);
    return '638900000000000000\r\n';
  } };
  assert.equal(currentBootId(undefined, windows), 'win32:638900000000000000');
  assert.equal(processStart(42, undefined, windows), '638900000000000000');
  for (const platform of ['darwin', 'win32']) {
    const fail = { platform, execFile: () => { throw new Error('access denied'); } };
    assert.equal(currentBootId(undefined, fail), undefined);
    assert.equal(processStart(42, undefined, fail), undefined);
    assert.equal(processStart('42; unsafe', undefined, fail), undefined);
  }
});

for (const platform of ['linux', 'darwin', 'win32', 'wsl']) {
  test(`launcher selects ${platform}, local domain and literal arguments`, async () => {
    let captured;
    const opts = {
      platform, wezterm: 'wezterm', distro: 'Arch', cwd: "C:\\work's $x & 中文", sessionFile: "C:\\session's %x%.jsonl",
      piBin: '/custom/pi', piCommand: ['C:\\node.exe', 'C:\\pi\\cli.js'],
      env: { PATH: '/tools', PI_CODING_AGENT_DIR: "C:\\agent's $data" },
      spawner: async (_program, args) => { captured = args; return { ok: true }; },
    };
    assert.equal((await openTab(opts)).ok, true);
    assert.deepEqual(captured.slice(0, 5), ['cli', 'spawn', '--domain-name', 'local', '--']);
    assert.equal(captured.includes('wsl.exe'), platform === 'wsl');
    if (platform === 'win32') {
      assert.equal(captured.at(-2), '-EncodedCommand');
      const script = Buffer.from(captured.at(-1), 'base64').toString('utf16le');
      assert.match(script, /Set-Location -LiteralPath 'C:\\work''s \$x & 中文'/);
      assert.match(script, /& 'C:\\node.exe' 'C:\\pi\\cli.js' '--session'/);
      assert.ok(script.includes(powershellQuote(opts.sessionFile)));
      assert.doesNotMatch(script, /cmd\.exe|bash|Invoke-Expression/);
    } else {
      assert.deepEqual(captured.slice(-3, -1), ['bash', '-lc']);
      assert.ok(captured.at(-1).includes("exec '/custom/pi' --session"));
    }
  });
}

test('native preflight checks mux connectivity and fails closed when liveness is unavailable', (t) => {
  const root = fixture(t);
  const wezterm = join(root, 'wezterm');
  fs.writeFileSync(wezterm, 'fixture');
  const opts = {
    platform: nativePlatform, env: process.env, wezterm,
    prober: () => ({ status: 0 }),
    piProber: () => nativePlatform === 'win32'
      ? { piBin: process.execPath, piCommand: [process.execPath] }
      : { status: 0, stdout: '/custom/pi' },
    identityProber: () => ({ bootId: 'boot', processStart: 'start' }),
  };
  const pre = preflight(opts);
  assert.equal(pre.ok, true, JSON.stringify(pre.checks));
  assert.equal(pre.checks.some(c => c.name.startsWith('WSL')), false);
  const offline = preflight({ ...opts, prober: (_program, args) => ({ status: args[0] === 'cli' ? 1 : 0 }) });
  assert.equal(offline.ok, false);
  assert.equal(offline.checks.find(c => c.name === 'WezTerm 运行实例').ok, false);
  assert.equal(preflight({ ...opts, identityProber: () => ({}) }).ok, false);
});

test('real host liveness, reboot/PID reuse guards and lock/claim takeover', async (t) => {
  const root = fixture(t);
  const paths = workspacePaths({ PI_CODING_AGENT_DIR: root });
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
  const exited = new Promise(resolve => child.once('exit', resolve));
  t.after(() => child.kill());
  await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
  const identity = { pid: child.pid, bootId: currentBootId(), processStart: processStart(child.pid) };
  assert.ok(identity.bootId);
  assert.ok(identity.processStart);
  assert.equal(isLive(identity), true);
  assert.equal(isLive({ ...identity, bootId: 'previous boot' }), false);
  assert.equal(isLive({ ...identity, processStart: 'reused PID' }), false);
  acquireRestoreLock(paths, child.pid);
  assert.equal(acquireRestoreLock(paths).locked, true);
  claimSession('held', child.pid, paths);
  assert.equal(claimSession('held', process.pid, paths).claimed, false);
  child.kill();
  await exited;
  assert.equal(processStart(child.pid), undefined);
  assert.equal(isLive(identity), false);
  assert.equal(acquireRestoreLock(paths).locked, false);
  assert.equal(claimSession('held', process.pid, paths).claimed, true);
  releaseRestoreLock(paths);
});

test('native restore skips live sessions, launches missing sessions and retains verification semantics', async (t) => {
  const root = fixture(t);
  const env = { ...process.env, PI_CODING_AGENT_DIR: root, PI_WORKSPACE_WEZTERM: join(root, 'wezterm') };
  fs.writeFileSync(env.PI_WORKSPACE_WEZTERM, 'fixture');
  const paths = workspacePaths(env);
  const sessionFile = join(root, 'saved.jsonl');
  fs.writeFileSync(sessionFile, '{}\n');
  writeMember({ sessionId: 'restore', cwd: root, sessionFile, ts: 1 }, paths);
  writeMember({ sessionId: 'live', cwd: root, sessionFile, ts: 2,
    pid: process.pid, bootId: currentBootId(), processStart: processStart(process.pid) }, paths);
  const calls = [];
  const result = await runRestore({
    platform: nativePlatform, env, noWait: true, prober: () => ({ status: 0 }),
    piProber: () => nativePlatform === 'win32' ? { piBin: process.execPath, piCommand: [process.execPath] } : { status: 0, stdout: '/custom/pi' },
    spawner: async (_program, args) => { calls.push(args); return { ok: true }; },
  });
  assert.equal(result.stage, 'done', JSON.stringify(result.checks));
  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].includes('wsl.exe'), false);
  assert.equal(result.verification, null);
  assert.equal(result.plan.items.find(i => i.entry.sessionId === 'live').state, 'live');
});

test('native POSIX preflight and launch script preserve the exact Pi path and environment', { skip: nativePlatform === 'win32' }, async (t) => {
  const root = fixture(t);
  const cwd = join(root, "project's $data 中文");
  fs.mkdirSync(cwd);
  const pi = join(cwd, 'custom-pi');
  fs.writeFileSync(pi, '#!/bin/sh\nprintf "%s\\n" "$PWD" "$PI_CODING_AGENT_DIR" "$@"\n', { mode: 0o755 });
  const env = { ...process.env, PI_CODING_AGENT_DIR: cwd, PI_WORKSPACE_PI_BIN: pi };
  const pre = preflight({ platform: nativePlatform, env, wezterm: process.execPath, prober: () => ({ status: 0 }) });
  assert.equal(pre.ok, true, JSON.stringify(pre.checks));
  assert.equal(pre.piBin, pi);
  const sessionFile = join(cwd, "session's $file.jsonl");
  const result = await openTab({ ...pre, env, cwd, sessionFile, spawner: async (_program, args) => {
    const run = spawnSync('bash', ['--noprofile', '--norc', '-c', args.at(-1)], { env, encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    assert.deepEqual(run.stdout.trim().split('\n'), [cwd, cwd, '--session', sessionFile]);
    return { ok: true };
  } });
  assert.equal(result.ok, true);
});

test('Windows preflight resolves a real npm-layout fixture without Bash', { skip: nativePlatform !== 'win32' }, (t) => {
  const root = fixture(t);
  const pkg = join(root, 'node_modules', '@earendil-works', 'pi-coding-agent');
  fs.mkdirSync(pkg, { recursive: true });
  fs.writeFileSync(join(root, 'pi.cmd'), '@echo off\r\n');
  fs.writeFileSync(join(pkg, 'package.json'), JSON.stringify({ name: '@earendil-works/pi-coding-agent', bin: { pi: 'cli.js' } }));
  fs.writeFileSync(join(pkg, 'cli.js'), '// fixture');
  const env = { ...process.env, PI_WORKSPACE_PI_BIN: join(root, 'pi.cmd') };
  const pre = preflight({ env, wezterm: process.execPath, prober: () => ({ status: 0 }) });
  assert.equal(pre.ok, true, JSON.stringify(pre.checks));
  assert.deepEqual(pre.piCommand, [process.execPath, join(pkg, 'cli.js')]);
  const missing = preflight({ env: { ...env, PI_WORKSPACE_PI_BIN: join(root, 'missing.cmd') }, wezterm: process.execPath, prober: () => ({ status: 0 }) });
  assert.equal(missing.ok, false);
});

test('Windows PowerShell round-trips literal paths and session arguments', { skip: nativePlatform !== 'win32' }, (t) => {
  const root = fixture(t);
  const cwd = join(root, "项目's $data & %PATH% [x]");
  fs.mkdirSync(cwd);
  const entry = join(root, 'echo.mjs');
  const output = join(root, 'output.json');
  fs.writeFileSync(entry, `import { writeFileSync } from 'node:fs'; writeFileSync(${JSON.stringify(output)}, JSON.stringify([process.cwd(), process.env.PI_CODING_AGENT_DIR, ...process.argv.slice(2)]));`);
  const sessionFile = join(cwd, "saved's $session.jsonl");
  const env = { ...process.env, PI_CODING_AGENT_DIR: cwd };
  const script = buildWindowsScript({ cwd, sessionFile, piCommand: [process.execPath, entry], env });
  const result = spawnSync(powershellPath(), powershellArgs(script), { env, encoding: 'utf8', timeout: 15000 });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(fs.readFileSync(output, 'utf8')), [cwd, cwd, '--session', sessionFile]);
});
