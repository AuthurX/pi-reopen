import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const project = dirname(dirname(fileURLToPath(import.meta.url)));

function fixture(t, { fail = false, version = '1.0.2', objectResult = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'pi-reopen-publish-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const sub of ['scripts', 'bin', 'archive/package']) mkdirSync(join(dir, sub), { recursive: true });
  copyFileSync(join(project, 'scripts/publish-legacy.mjs'), join(dir, 'scripts/publish-legacy.mjs'));
  const raw = JSON.stringify({ name: 'pi-reopen', version, keywords: ['pi-package', 'session-recovery'], scripts: { prepublishOnly: 'must-not-run' }, bin: { 'pi-reopen': 'bin/pi-reopen.js' } });
  writeFileSync(join(dir, 'package.json'), raw);
  writeFileSync(join(dir, 'archive/package/package.json'), raw);
  writeFileSync(join(dir, 'archive/package/LICENSE'), 'fixture');
  execFileSync('tar', ['-czf', join(dir, 'fixture.tgz'), '-C', join(dir, 'archive'), 'package']);
  const npm = join(dir, 'bin/npm');
  writeFileSync(npm, `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
if (args[0] === 'pack') {
  fs.copyFileSync(${JSON.stringify(join(dir, 'fixture.tgz'))}, path.join(args[args.indexOf('--pack-destination') + 1], 'fixture.tgz'));
  console.log(JSON.stringify(${objectResult ? "{ 'pi-reopen': { filename: 'fixture.tgz' } }" : "[{ filename: 'fixture.tgz' }]"}));
} else if (args[0] === 'publish') {
  fs.writeFileSync(${JSON.stringify(join(dir, 'observed.json'))}, JSON.stringify({args, cwd: process.cwd(), pkg: JSON.parse(fs.readFileSync('package.json', 'utf8')), license: fs.existsSync('LICENSE')}));
  process.exit(${fail ? 7 : 0});
} else { process.exit(9); }
`);
  chmodSync(npm, 0o755);
  return { dir, raw, run: (...args) => spawnSync(process.execPath, ['scripts/publish-legacy.mjs', ...args], {
    cwd: dir, env: { ...process.env, PATH: `${join(dir, 'bin')}:${process.env.PATH}` }, encoding: 'utf8', timeout: 15000,
  }) };
}

for (const objectResult of [false, true]) {
  test(`legacy dry-run preserves worktree and forwards flags (object pack result=${objectResult})`, { skip: process.platform === 'win32' }, (t) => {
    const f = fixture(t, { objectResult });
    const result = f.run('--dry-run', '--provenance');
    assert.equal(result.status, 0, result.stderr);
    const seen = JSON.parse(readFileSync(join(f.dir, 'observed.json'), 'utf8'));
    assert.equal(seen.pkg.name, '@ellieyujin/pi-reopen');
    assert.equal(seen.pkg.version, '1.0.2');
    assert.deepEqual(seen.pkg.keywords, ['session-recovery']);
    assert.equal(seen.pkg.scripts, undefined);
    assert.deepEqual(seen.pkg.bin, { 'pi-reopen': 'bin/pi-reopen.js' });
    assert.equal(seen.license, true);
    assert.deepEqual(seen.args, ['publish', '--access', 'public', '--tag', 'latest', '--dry-run', '--provenance']);
    assert.equal(readFileSync(join(f.dir, 'package.json'), 'utf8'), f.raw);
    assert.equal(existsSync(seen.cwd), false, 'temporary package must be removed');
  });
}

test('legacy publish failure cleans staging and preserves source', { skip: process.platform === 'win32' }, (t) => {
  const f = fixture(t, { fail: true, version: '1.0.3-next.1' });
  const result = f.run('--dry-run');
  assert.notEqual(result.status, 0);
  const seen = JSON.parse(readFileSync(join(f.dir, 'observed.json'), 'utf8'));
  assert.equal(seen.args[seen.args.indexOf('--tag') + 1], 'next');
  assert.equal(existsSync(seen.cwd), false);
  assert.equal(readFileSync(join(f.dir, 'package.json'), 'utf8'), f.raw);
});

test('legacy publish rejects unknown arguments before invoking npm', { skip: process.platform === 'win32' }, (t) => {
  const f = fixture(t);
  const result = f.run('--otp=not-accepted');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Usage:/);
  assert.equal(existsSync(join(f.dir, 'observed.json')), false);
});
