import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { compareSemver, shasMatch, versionFromPackageTag } from './resolve-release-tag.mjs';

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

test('shasMatch accepts a prefix of at least 7 hex chars', () => {
  assert.equal(shasMatch('abcdef1def456', 'abcdef1'), true);
  assert.equal(shasMatch('ABCDEF1', 'abcdef1def456'), true);
  assert.equal(shasMatch('abcdef1', 'abcdef2'), false);
  assert.equal(shasMatch('abc', 'abc'), false);
});

test('CLI writes found/tag/version/sha from --tag', () => {
  const result = spawnSync(
    process.execPath,
    [script, '--package', '@poc-plattform-kit/api', '--tag', '@poc-plattform-kit/api@0.25.0'],
    { encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /found=true/);
  assert.match(result.stdout, /tag=@poc-plattform-kit\/api@0\.25\.0/);
  assert.match(result.stdout, /version=0\.25\.0/);
  assert.match(result.stdout, /sha=/);
});

test('CLI exits 1 when the tag does not match the package', () => {
  const result = spawnSync(
    process.execPath,
    [script, '--package', '@poc-plattform-kit/web', '--tag', '@poc-plattform-kit/api@0.25.0'],
    { encoding: 'utf8' },
  );
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /not a @poc-plattform-kit\/web release tag/);
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
  assert.match(written, /sha=/);
});

function initTaggedRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'rel-tag-'));
  const gitEnv = {
    ...process.env,
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_SYSTEM: '/dev/null',
    GIT_AUTHOR_NAME: 'ci',
    GIT_AUTHOR_EMAIL: 'ci@example.com',
    GIT_COMMITTER_NAME: 'ci',
    GIT_COMMITTER_EMAIL: 'ci@example.com',
  };
  const git = (args) => spawnSync('git', args, { cwd: dir, encoding: 'utf8', env: gitEnv });
  git(['init']);
  git(['config', 'user.email', 'ci@example.com']);
  git(['config', 'user.name', 'ci']);
  git(['config', 'commit.gpgsign', 'false']);
  writeFileSync(join(dir, 'f'), 'x');
  git(['add', 'f']);
  const commit = git(['commit', '-m', 'init']);
  if (commit.status !== 0) {
    throw new Error(commit.stderr || commit.stdout);
  }
  git(['tag', '-a', '@poc-plattform-kit/api@0.25.0', '-m', 't']);
  const sha = git(['rev-parse', 'HEAD']).stdout.trim();
  return { dir, sha };
}

test('CLI rejects a release_tag that does not point at release_sha', () => {
  const { dir } = initTaggedRepo();
  const result = spawnSync(
    process.execPath,
    [
      script,
      '--package',
      '@poc-plattform-kit/api',
      '--tag',
      '@poc-plattform-kit/api@0.25.0',
      '--sha',
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    ],
    { cwd: dir, encoding: 'utf8' },
  );
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /points at/);
});

test('CLI accepts matching release_tag and release_sha', () => {
  const { dir, sha } = initTaggedRepo();
  const result = spawnSync(
    process.execPath,
    [
      script,
      '--package',
      '@poc-plattform-kit/api',
      '--tag',
      '@poc-plattform-kit/api@0.25.0',
      '--sha',
      sha,
    ],
    { cwd: dir, encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /found=true/);
  assert.match(result.stdout, new RegExp(`sha=${sha}`));
});
