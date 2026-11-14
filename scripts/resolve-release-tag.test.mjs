import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { compareSemver, versionFromPackageTag } from './resolve-release-tag.mjs';

const script = fileURLToPath(new URL('./resolve-release-tag.mjs', import.meta.url));

test('versionFromPackageTag accepts the repo tag format', () => {
  assert.equal(
    versionFromPackageTag('@poc-plattform-kit/web', '@poc-plattform-kit/web@0.17.0'),
    '0.17.0',
  );
  assert.equal(
    versionFromPackageTag('@poc-plattform-kit/web', '@poc-plattform-kit/api@0.25.0'),
    null,
  );
  assert.equal(versionFromPackageTag('@poc-plattform-kit/web', ''), null);
});

test('compareSemver orders dotted triples', () => {
  assert.ok(compareSemver('0.9.1', '0.10.0') < 0);
  assert.ok(compareSemver('1.0.0', '0.25.0') > 0);
  assert.equal(compareSemver('0.25.0', '0.25.0'), 0);
});

test('CLI writes found/tag/version from --tag without git', () => {
  const result = spawnSync(
    process.execPath,
    [script, '--package', '@poc-plattform-kit/api', '--tag', '@poc-plattform-kit/api@0.25.0'],
    { encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /found=true/);
  assert.match(result.stdout, /tag=@poc-plattform-kit\/api@0\.25\.0/);
  assert.match(result.stdout, /version=0\.25\.0/);
});

test('CLI exits 0 with found=false when the tag does not match the package', () => {
  const result = spawnSync(
    process.execPath,
    [script, '--package', '@poc-plattform-kit/web', '--tag', '@poc-plattform-kit/api@0.25.0'],
    { encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /found=false/);
});

test('CLI appends GitHub Actions output when GITHUB_OUTPUT is set', () => {
  const dir = mkdtempSync(join(tmpdir(), 'release-tag-'));
  const output = join(dir, 'github-output');
  writeFileSync(output, '');
  const result = spawnSync(
    process.execPath,
    [
      script,
      '--package',
      '@poc-plattform-kit/marketing',
      '--tag',
      '@poc-plattform-kit/marketing@0.10.0',
    ],
    { encoding: 'utf8', env: { ...process.env, GITHUB_OUTPUT: output } },
  );
  assert.equal(result.status, 0, result.stderr);
  const written = readFileSync(output, 'utf8');
  assert.match(written, /found=true/);
  assert.match(written, /version=0\.10\.0/);
});
