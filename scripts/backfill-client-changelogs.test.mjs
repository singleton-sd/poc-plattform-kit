import assert from 'node:assert/strict';
import test from 'node:test';
import { versionsFromTags } from './backfill-client-changelogs.mjs';

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
