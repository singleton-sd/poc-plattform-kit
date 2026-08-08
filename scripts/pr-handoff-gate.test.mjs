import assert from 'node:assert/strict';
import { evaluateSnapshot, expectedChecks } from './pr-handoff-gate.mjs';

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
console.log('pr-handoff-gate tests passed');
