import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { run as cliRun } from '../src/cli.js';
import { registryHealth, writeExtensionRecord } from '../src/health.js';
import { currentBootId, processStart } from '../src/liveness.js';
import { listMembers, writeMember } from '../src/members.js';
import { workspacePaths } from '../src/paths.js';
import { installationChecks, setupSteps } from '../src/setup.js';
import { packageVersion } from '../src/version.js';

function fixture(t) {
  const home = fs.mkdtempSync(join(tmpdir(), 'pi-reopen-setup-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const paths = workspacePaths({ HOME: home });
  const bin = join(home, 'bin');
  fs.mkdirSync(paths.sessions, { recursive: true });
  fs.mkdirSync(paths.agent, { recursive: true });
  fs.mkdirSync(bin, { recursive: true });
  const wezterm = join(bin, 'wezterm');
  fs.writeFileSync(wezterm, '#!/bin/sh\nif [ "$1" = "--version" ]; then echo "wezterm 1.0"; exit 0; fi\necho "[]"\n');
  const pi = join(bin, 'pi');
  fs.writeFileSync(pi, '#!/bin/sh\nexit 0\n');
  const cli = join(bin, 'pi-reopen');
  fs.writeFileSync(cli, `#!/bin/sh\necho "pi-reopen ${packageVersion()}"\n`);
  for (const file of [wezterm, pi, cli]) fs.chmodSync(file, 0o755);
  fs.writeFileSync(join(paths.agent, 'settings.json'), JSON.stringify({ packages: ['npm:@ellieyujin/pi-reopen@latest'] }));
  const env = {
    HOME: home,
    PATH: `${bin}:/usr/bin:/bin`,
    PI_CODING_AGENT_DIR: paths.agent,
    PI_REOPEN_LANG: 'en',
    PI_REOPEN_WEZTERM: wezterm,
    PI_REOPEN_PI_BIN: pi,
  };
  if (fs.existsSync('/run/WSL')) env.WSL_DISTRO_NAME = 'Test';
  return { home, bin, paths, env };
}

function entry(paths, sessionId, ts) {
  const sessionFile = join(paths.sessions, `${sessionId}.jsonl`);
  fs.writeFileSync(sessionFile, '{}\n');
  return { sessionId, name: `task-${sessionId}`, cwd: paths.agent, sessionFile, ts };
}

function output() {
  const lines = [];
  return { lines, stdout: { write: (line) => lines.push(line), on: () => {}, columns: 160 } };
}

test('setup performs real read-only checks and rejects a stale extension self-record', async (t) => {
  const f = fixture(t);
  writeExtensionRecord({ version: packageVersion(), ts: Date.now() }, f.paths);
  let out = output();
  assert.equal(await cliRun(['setup'], { stdout: out.stdout, env: f.env }), 2);
  const stale = out.lines.join('\n');
  assert.match(stale, /historical record only/);
  assert.match(stale, /Global CLI and PATH/);
  assert.match(stale, /\/reload/);
  assert.match(stale, /read-only checks, no system changes/);
  if (f.env.WSL_DISTRO_NAME) {
    assert.match(stale, /WSL single-tab close detection/);
    assert.match(stale, /WEZTERM_PANE/);
  }

  writeExtensionRecord({
    version: packageVersion(), pid: process.pid, processStart: processStart(process.pid), bootId: currentBootId(), ts: Date.now(),
  }, f.paths);
  out = output();
  assert.equal(await cliRun(['setup'], { stdout: out.stdout, env: f.env }), 0);
  assert.match(out.lines.join('\n'), /Installation and runtime checks complete/);
  assert.match(out.lines.join('\n'), /restore --dry-run/);
});

test('setup reports duplicate legacy entries and gives manual next commands', (t) => {
  const f = fixture(t);
  fs.mkdirSync(join(f.paths.agent, 'extensions'));
  const old = join(f.paths.agent, 'extensions', 'open-all.ts');
  fs.writeFileSync(old, '');
  const health = registryHealth({ paths: f.paths, env: f.env });
  const result = installationChecks({
    env: f.env, paths: f.paths, health, platform: 'linux', lang: 'en',
    runner: () => ({ status: 0, stdout: `pi-reopen ${packageVersion()}` }),
  });
  const duplicate = result.checks.find((check) => check.name === 'Duplicate/legacy extension entries');
  assert.equal(duplicate.ok, false);
  assert.match(duplicate.detail, /open-all\.ts/);
  assert.match(duplicate.hint, /pi list/);
  const steps = setupSteps({ env: f.env, health, result, platform: 'linux', lang: 'en' }).join('\n');
  assert.match(steps, /pi remove <exact old source>/);
  assert.match(steps, /\/reload/);
});

test('list indexes drive dry-run restore, details and forget using the same order', async (t) => {
  const f = fixture(t);
  const now = Date.now();
  for (const [index, id] of ['alpha', 'beta', 'gamma'].entries()) writeMember(entry(f.paths, id, now - 3000 + index * 1000), f.paths);
  let out = output();
  assert.equal(await cliRun(['restore', '--dry-run', '--only', '1,3'], { stdout: out.stdout, env: f.env }), 0);
  const selected = out.lines.filter((line) => line.startsWith('  →'));
  assert.equal(selected.length, 2);
  assert.match(selected[0], /task-alpha/);
  assert.match(selected[1], /task-gamma/);
  assert.doesNotMatch(selected.join('\n'), /task-beta/);

  out = output();
  assert.equal(await cliRun(['show', '2'], { stdout: out.stdout, env: f.env }), 0);
  assert.match(out.lines.join('\n'), /#2 task-beta/);
  assert.match(out.lines.join('\n'), /Session ID: beta/);
  assert.match(out.lines.join('\n'), /Session file:/);

  out = output();
  assert.equal(await cliRun(['forget', '2'], { stdout: out.stdout, env: f.env }), 0);
  assert.deepEqual(listMembers(f.paths).map((member) => member.sessionId), ['alpha', 'gamma']);
  out = output();
  assert.equal(await cliRun(['forget', '3'], { stdout: out.stdout, env: f.env }), 1);
  assert.match(out.lines.join('\n'), /not stable IDs/);
  assert.deepEqual(listMembers(f.paths).map((member) => member.sessionId), ['alpha', 'gamma'], '无效序号不得删除其他记录');
});

test('interactive restore selects from the displayed snapshot and supports cancellation', async (t) => {
  const f = fixture(t);
  const now = Date.now();
  writeMember(entry(f.paths, 'alpha', now - 2000), f.paths);
  writeMember(entry(f.paths, 'beta', now - 1000), f.paths);
  let out = output();
  const code = await cliRun(['restore', '--interactive', '--dry-run'], { stdout: out.stdout, env: f.env, prompt: async () => '2' });
  assert.equal(code, 0);
  const selected = out.lines.filter((line) => line.startsWith('  →'));
  assert.equal(selected.length, 1);
  assert.match(selected[0], /task-beta/);
  out = output();
  assert.equal(await cliRun(['restore', '--interactive'], { stdout: out.stdout, env: f.env, prompt: async () => '' }), 0);
  assert.match(out.lines.join('\n'), /Cancelled; no tabs opened/);
});
