import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertCompleteTagHistory,
  validateBackfillCoverage,
  versionsFromTags,
} from './backfill-client-changelogs.mjs';

test('selects and semantically orders tags for one product', () => {
  assert.deepEqual(
    versionsFromTags('@poc-plattform-kit/web', [
      '@poc-plattform-kit/api@9.0.0',
      '@poc-plattform-kit/web@0.10.0',
      '@poc-plattform-kit/web@0.2.0',
      '@poc-plattform-kit/web@invalid',
    ]),
    [
      { tag: '@poc-plattform-kit/web@0.2.0', version: '0.2.0' },
      { tag: '@poc-plattform-kit/web@0.10.0', version: '0.10.0' },
    ],
  );
});

test('rejects a partial clone before it can truncate existing history', () => {
  assert.throws(
    () =>
      assertCompleteTagHistory(
        '@poc-plattform-kit/api',
        [{ version: '1.0.0' }, { version: '0.9.0' }],
        [{ version: '1.0.0' }],
      ),
    /missing 0\.9\.0.*git fetch origin --tags/,
  );
});

test('accepts tags covering every existing release', () => {
  assert.doesNotThrow(() =>
    assertCompleteTagHistory(
      '@poc-plattform-kit/api',
      [{ version: '1.0.0' }],
      [{ version: '0.9.0' }, { version: '1.0.0' }],
    ),
  );
});

test('preflights every product before any history rewrite can begin', () => {
  const reads = [];
  assert.throws(
    () =>
      validateBackfillCoverage(
        [
          '@poc-plattform-kit/api@1.0.0',
          '@poc-plattform-kit/web@1.0.0',
          '@poc-plattform-kit/marketing@1.0.0',
        ],
        (relativePath) => {
          reads.push(relativePath);
          if (relativePath.includes('web')) {
            return '# Changelog\n\n## 1.0.0 — 2026-01-01\n\n### New\n\n- Add release history\n\n## 0.9.0 — 2025-12-01\n\n### Fixed\n\n- Patch filters\n';
          }
          return '# Changelog\n\n## 1.0.0 — 2026-01-01\n\n### New\n\n- Add release history\n';
        },
      ),
    /@poc-plattform-kit\/web.*missing 0\.9\.0/,
  );
  assert.deepEqual(reads, ['apps/api/CHANGELOG.md', 'apps/web/CHANGELOG.md']);
});
