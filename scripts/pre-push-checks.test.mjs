import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCheckPlan,
  changedFilesForPushRef,
  collectChangedFilesFromStdin,
  parsePrePushLine,
  plannedCommands,
  resolveDiffRange,
  runPlannedChecks,
} from './pre-push-checks.mjs';

test('parsePrePushLine parses git pre-push stdin rows', () => {
  assert.deepEqual(parsePrePushLine('refs/heads/feat/foo abc123 refs/heads/feat/foo def456'), {
    localRef: 'refs/heads/feat/foo',
    localSha: 'abc123',
    remoteRef: 'refs/heads/feat/foo',
    remoteSha: 'def456',
  });
  assert.equal(parsePrePushLine('incomplete line'), null);
});

test('resolveDiffRange uses remote..local for updates and merge-base for new branches', () => {
  const calls = [];
  const runGit = (args) => {
    calls.push(args);
    if (args[0] === 'rev-parse') return 'origin/main';
    if (args[0] === 'merge-base') return 'base123';
    return '';
  };

  assert.equal(resolveDiffRange('local123', 'remote456', runGit), 'remote456..local123');
  assert.equal(
    resolveDiffRange('local123', '0000000000000000000000000000000000000000', runGit),
    'base123..local123',
  );
  assert.deepEqual(calls, [
    ['rev-parse', '--verify', 'origin/main'],
    ['merge-base', 'origin/main', 'local123'],
  ]);
});

test('collectChangedFilesFromStdin ignores tags and unions branch file lists', () => {
  const runGit = (args) => {
    if (args[0] === 'rev-parse') return 'origin/main';
    if (args[0] === 'merge-base') return 'base';
    if (args[0] === 'diff' && args[2] === 'base..headsha') {
      return 'apps/web/src/lib/utils.ts';
    }
    if (args[0] === 'diff' && args[2] === 'remote..local') {
      return 'apps/api/src/main.ts\npackages/email/src/index.ts';
    }
    return '';
  };

  const stdin = [
    'HEAD headsha refs/heads/feature 0000000000000000000000000000000000000000',
    'refs/tags/v1.0.0 tagsha refs/tags/v1.0.0 0000000000000000000000000000000000000000',
    'abc123 local refs/heads/feature remote',
    '0000000000000000000000000000000000000000 0000000000000000000000000000000000000000 refs/heads/deleted remote',
  ].join('\n');

  assert.deepEqual([...collectChangedFilesFromStdin(stdin, runGit)].sort(), [
    'apps/api/src/main.ts',
    'apps/web/src/lib/utils.ts',
    'packages/email/src/index.ts',
  ]);
});

test('buildCheckPlan mirrors pr-handoff expected CI suites', () => {
  assert.deepEqual(buildCheckPlan(['apps/api/src/main.ts']), {
    paths: ['apps/api/src/main.ts'],
    api: true,
    web: false,
  });
  assert.deepEqual(buildCheckPlan(['apps/web/src/app/page.tsx']), {
    paths: ['apps/web/src/app/page.tsx'],
    api: false,
    web: true,
  });
  assert.deepEqual(buildCheckPlan(['package.json']), {
    paths: ['package.json'],
    api: true,
    web: true,
  });
  assert.deepEqual(buildCheckPlan(['docs/architecture/overview.md']), {
    paths: ['docs/architecture/overview.md'],
    api: false,
    web: false,
  });
});

test('plannedCommands dedupes shared checks when both suites run', () => {
  const labels = plannedCommands({ api: true, web: true, paths: ['package.json'] }).map(
    ([, label]) => label,
  );
  assert.equal(labels.filter((label) => label === 'Prettier check').length, 1);
  assert.equal(labels.filter((label) => label === 'ESLint (repo root)').length, 1);
  assert.ok(labels.includes('Build (api + pillars + packages)'));
  assert.ok(labels.includes('Build (web + marketing + packages)'));
});

test('plannedCommands includes packages workspace in api test and build', () => {
  const commands = plannedCommands({
    api: true,
    web: false,
    paths: ['packages/config/src/index.ts'],
  });
  const testCmd = commands.find(([, label]) => label === 'Test (api + pillars + packages)');
  const buildCmd = commands.find(([, label]) => label === 'Build (api + pillars + packages)');
  assert.match(testCmd[0], /packages\/\*\*/);
  assert.match(buildCmd[0], /packages\/\*\*/);
});

test('runPlannedChecks dry-run lists selected steps only', () => {
  const result = runPlannedChecks(
    { api: true, web: false, paths: ['apps/api/src/main.ts'] },
    { dryRun: true },
  );
  assert.equal(result.ran, true);
  assert.ok(result.commands.includes('Build (api + pillars + packages)'));
  assert.ok(!result.commands.includes('Build (web + marketing + packages)'));
});

test('changedFilesForPushRef skips non-branch remote refs and deletions', () => {
  const runGit = () => {
    throw new Error('git should not run for skipped refs');
  };
  assert.deepEqual(
    changedFilesForPushRef(
      {
        localRef: 'refs/tags/v1.0.0',
        localSha: 'abc',
        remoteRef: 'refs/tags/v1.0.0',
        remoteSha: '0000000000000000000000000000000000000000',
      },
      runGit,
    ),
    [],
  );
  assert.deepEqual(
    changedFilesForPushRef(
      {
        localRef: '0000000000000000000000000000000000000000',
        localSha: '0000000000000000000000000000000000000000',
        remoteRef: 'refs/heads/deleted',
        remoteSha: 'remote',
      },
      runGit,
    ),
    [],
  );
});

test('changedFilesForPushRef accepts HEAD and SHA local refs when remote is a branch', () => {
  const runGit = (args) => {
    if (args[0] === 'rev-parse') return 'origin/main';
    if (args[0] === 'merge-base') return 'base';
    if (args[0] === 'diff' && args[2] === 'base..headsha') return 'apps/web/src/lib/utils.ts';
    if (args[0] === 'diff' && args[2] === 'remote..abc123') return 'apps/api/src/main.ts';
    return '';
  };
  assert.deepEqual(
    changedFilesForPushRef(
      {
        localRef: 'HEAD',
        localSha: 'headsha',
        remoteRef: 'refs/heads/feature',
        remoteSha: '0000000000000000000000000000000000000000',
      },
      runGit,
    ),
    ['apps/web/src/lib/utils.ts'],
  );
  assert.deepEqual(
    changedFilesForPushRef(
      {
        localRef: 'abc123',
        localSha: 'abc123',
        remoteRef: 'refs/heads/feature',
        remoteSha: 'remote',
      },
      runGit,
    ),
    ['apps/api/src/main.ts'],
  );
});
