import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  clientFacingChanges,
  formatProductChangelog,
  parseProductChangelog,
  updateClientChangelogs,
} from './client-changelog.mjs';

test('turns releasable conventional commits into public changes', () => {
  assert.deepEqual(
    clientFacingChanges([
      'feat: SSDOP-42 Add audit history (#42)\n\nSo administrators can explain account changes.',
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

test('keeps breaking changes regardless of conventional commit type', () => {
  assert.deepEqual(
    clientFacingChanges([
      'refactor(api)!: Replace legacy identifiers\n\nUse stable tenant IDs instead.',
      'chore: Remove deprecated endpoint\n\nBREAKING CHANGE: Clients must use /v2/items.',
    ]),
    [
      {
        type: 'Breaking',
        summary: 'Replace legacy identifiers',
        reason: 'Use stable tenant IDs instead.',
      },
      {
        type: 'Breaking',
        summary: 'Remove deprecated endpoint',
        reason: 'Clients must use /v2/items.',
      },
    ],
  );
});

test('ignores Markdown structure when selecting explanatory prose', () => {
  assert.deepEqual(
    clientFacingChanges([
      'feat: Add tenant search\n\n* feat: Add search input\n# Notes\nFind tenants faster.',
    ]),
    [{ type: 'New', summary: 'Add tenant search', reason: 'Find tenants faster.' }],
  );
});

test('prepends releases without dropping historical versions', () => {
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
  assert.equal(output.releases.length, 21);
  assert.equal(output.releases[0].version, '1.0.20');
  assert.equal(output.releases.at(-1).version, '1.0.0');
  const markdown = readFileSync(join(root, 'apps/web/CHANGELOG.md'), 'utf8');
  assert.match(markdown, /^# Changelog/);
  assert.deepEqual(parseProductChangelog(markdown), output.releases);
});

test('round-trips summaries and reasons through the canonical Markdown', () => {
  const releases = [
    {
      version: '2.0.0',
      date: '2026-08-09',
      changes: [
        { type: 'Breaking', summary: 'Replace identifiers', reason: 'Use stable IDs.' },
        { type: 'Fixed', summary: 'Preserve filters' },
      ],
    },
  ];
  const markdown = formatProductChangelog('@poc-plattform-kit/api', releases);
  assert.match(markdown, /generated from conventional commits by the release-it workflow/);
  assert.deepEqual(parseProductChangelog(markdown), releases);
});
