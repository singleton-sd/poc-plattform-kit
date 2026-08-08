import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { clientFacingChanges, updateClientChangelogs } from './client-changelog.mjs';

test('turns releasable conventional commits into public changes', () => {
  assert.deepEqual(
    clientFacingChanges([
      'feat: SSDOP-42 Add audit history\n\nSo administrators can explain account changes.',
      'fix(api): 86d3zfgek Preserve filters',
      'chore: Update tooling',
    ]),
    [
      {
        type: 'New',
        summary: 'Add audit history',
        reason: 'So administrators can explain account changes.',
      },
      { type: 'Fixed', summary: 'Preserve filters' },
    ],
  );
});

test('prepends and limits generated product releases', () => {
  const root = mkdtempSync(join(tmpdir(), 'client-changelog-'));
  const releases = Array.from({ length: 21 }, (_, index) => ({
    name: '@poc-plattform-kit/web',
    next: `1.0.${index}`,
    messages: [`fix: Fix item ${index}`],
  }));

  for (const release of releases) {
    updateClientChangelogs(root, [release], '2026-08-08');
  }

  const output = JSON.parse(
    readFileSync(join(root, 'apps/web/src/content/changelog.json'), 'utf8'),
  );
  assert.equal(output.releases.length, 20);
  assert.equal(output.releases[0].version, '1.0.20');
  assert.equal(output.releases.at(-1).version, '1.0.1');
});
