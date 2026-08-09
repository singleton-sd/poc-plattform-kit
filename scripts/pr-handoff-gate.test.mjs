import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  blockerAction,
  evaluateSnapshot,
  expectedChecks,
  formatGateReport,
  isRateLimitError,
} from './pr-handoff-gate.mjs';

assert.deepEqual(expectedChecks(['apps/api/src/main.ts']), [
  'conflict-on-pr',
  'Lint / test / build (api)',
  'Build and deploy ACA preview',
]);
assert.deepEqual(expectedChecks(['package.json']), [
  'conflict-on-pr',
  'Lint / test / build (api)',
  'Lint / format / build (web)',
]);
assert.deepEqual(expectedChecks(['packages/api-client/openapi.json']), [
  'conflict-on-pr',
  'Lint / test / build (api)',
  'Build and deploy ACA preview',
  'Lint / format / build (web)',
  'Build + SWA preview',
]);

const now = Date.now();
const base = {
  headOid: 'abc',
  observedHeadOid: 'abc',
  mergeable: 'MERGEABLE',
  mergeStateStatus: 'CLEAN',
  labels: [],
  expected: ['CI'],
  checks: [{ name: 'CI', status: 'COMPLETED', conclusion: 'SUCCESS' }],
  unresolvedThreads: 0,
  lastActivityMs: now - 100_000,
};
assert.equal(evaluateSnapshot(base, now, 90_000).ready, true);
assert.match(
  evaluateSnapshot({ ...base, checks: [] }, now, 90_000).blockers.join(' '),
  /not registered/,
);
assert.match(
  evaluateSnapshot({ ...base, unresolvedThreads: 1 }, now, 90_000).blockers.join(' '),
  /unresolved/,
);
assert.match(
  evaluateSnapshot({ ...base, labels: ['has-feedback'] }, now, 90_000).blockers.join(' '),
  /blocking labels/,
);
assert.match(
  evaluateSnapshot({ ...base, lastActivityMs: now - 1_000 }, now, 90_000).blockers.join(' '),
  /quiet period/,
);
assert.equal(isRateLimitError('API rate limit already exceeded for site ID installation.'), true);
assert.equal(isRateLimitError('You have exceeded a secondary rate limit'), true);
assert.equal(isRateLimitError('gh: pull request not found'), false);
assert.equal(isRateLimitError(undefined), false);

assert.match(blockerAction('checks pending: Build + SWA preview'), /Wait/);
assert.match(blockerAction('check failed: CI Web (FAILURE)'), /Open the failed checks/);
const pr101Result = evaluateSnapshot(
  {
    ...base,
    expected: ['Build and deploy ACA preview', 'Build + SWA preview'],
    checks: [
      { name: 'Build and deploy ACA preview', status: 'IN_PROGRESS', conclusion: '' },
      { name: 'Build + SWA preview', status: 'COMPLETED', conclusion: 'CANCELLED' },
    ],
  },
  now,
  90_000,
);
const report = formatGateReport({ pr: 101, snapshot: base, result: pr101Result });
assert.match(report, /PR #101 handoff gate/);
assert.match(report, /checks pending: Build and deploy ACA preview/);
assert.match(report, /Re-run the cancelled checks/);
assert.match(report, /What to do/);

const mixedFailures = evaluateSnapshot(
  {
    ...base,
    expected: ['cancelled', 'broken'],
    checks: [
      { name: 'cancelled', status: 'COMPLETED', conclusion: 'CANCELLED' },
      { name: 'broken', status: 'COMPLETED', conclusion: 'FAILURE' },
    ],
  },
  now,
  90_000,
);
const mixedReport = formatGateReport({ pr: 101, snapshot: base, result: mixedFailures });
assert.match(mixedReport, /Re-run the cancelled checks/);
assert.match(mixedReport, /Open the failed checks/);

const workflow = readFileSync(
  new URL('../.github/workflows/pr-handoff-gate.yml', import.meta.url),
  'utf8',
);
assert.match(workflow, /cancel-in-progress: false/);
assert.match(workflow, /target_url=.*github\.run_id/);

console.log('pr-handoff-gate tests passed');
