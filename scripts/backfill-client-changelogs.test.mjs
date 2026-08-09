import assert from 'node:assert/strict';
import test from 'node:test';
import { assertCompleteTagHistory, versionsFromTags } from './backfill-client-changelogs.mjs';

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
