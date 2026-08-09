import assert from 'node:assert/strict';
import test from 'node:test';
import { validateProductProjection } from './check-client-changelogs.mjs';

const markdown = `# Changelog

## 1.1.0 — 2026-08-09

### New

- Add release history

  So customers can understand product changes.

## 1.0.0 — 2026-08-08
`;

const projection = {
  product: '@poc-plattform-kit/web',
  releases: [
    {
      version: '1.1.0',
      date: '2026-08-09',
      changes: [
        {
          type: 'New',
          summary: 'Add release history',
          reason: 'So customers can understand product changes.',
        },
      ],
    },
    { version: '1.0.0', date: '2026-08-08', changes: [] },
  ],
};

test('accepts JSON that is an exact projection of canonical Markdown', () => {
  assert.doesNotThrow(() =>
    validateProductProjection('@poc-plattform-kit/web', markdown, projection),
  );
});

test('rejects stale generated JSON', () => {
  const stale = structuredClone(projection);
  stale.releases.shift();

  assert.throws(
    () => validateProductProjection('@poc-plattform-kit/web', markdown, stale),
    /generated JSON does not match canonical Markdown/,
  );
});

test('rejects releases that are not newest first', () => {
  assert.throws(
    () =>
      validateProductProjection('@poc-plattform-kit/web', markdown, {
        ...projection,
        releases: [...projection.releases].reverse(),
      }),
    /newest-first semantic version order/,
  );
});
