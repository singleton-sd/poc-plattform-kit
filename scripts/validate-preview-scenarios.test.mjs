import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  seedAndVerifyDeclaredScenarios,
  touchesDataAffectingPaths,
  validateDeclaration,
} from './validate-preview-scenarios.mjs';

test('touchesDataAffectingPaths detects apps/api, pillars, and packages/db changes', () => {
  assert.equal(touchesDataAffectingPaths(['apps/api/src/main.ts']), true);
  assert.equal(touchesDataAffectingPaths(['pillars/tenant/src/tenant.service.ts']), true);
  assert.equal(touchesDataAffectingPaths(['packages/db/prisma/schema.prisma']), true);
});

test('touchesDataAffectingPaths ignores docs/infra/web-only changes', () => {
  assert.equal(touchesDataAffectingPaths(['docs/pr-pipelines.md']), false);
  assert.equal(touchesDataAffectingPaths(['apps/web/src/App.tsx']), false);
  assert.equal(touchesDataAffectingPaths(['infra/main.bicep']), false);
});

test('validateDeclaration requires a declaration for data-affecting changes', () => {
  const result = validateDeclaration({ kind: 'unset' }, ['apps/api/src/main.ts']);
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /must declare preview scenarios/);
});

test('validateDeclaration does not require a declaration for docs-only changes', () => {
  const result = validateDeclaration({ kind: 'unset' }, ['docs/pr-pipelines.md']);
  assert.equal(result.ok, true);
});

test('validateDeclaration accepts a not-applicable exemption with a reason', () => {
  const result = validateDeclaration({ kind: 'not-applicable', reason: 'CI workflow tweak only' }, [
    'apps/api/src/main.ts',
  ]);
  assert.equal(result.ok, true);
});

test('validateDeclaration rejects a not-applicable exemption with an empty reason', () => {
  const result = validateDeclaration({ kind: 'not-applicable', reason: '' }, [
    'apps/api/src/main.ts',
  ]);
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /must include a reason/);
});

test('validateDeclaration accepts a well-formed scenarios declaration (existence checked separately)', () => {
  const result = validateDeclaration({ kind: 'scenarios', names: ['demo'] }, [
    'apps/api/src/main.ts',
  ]);
  assert.equal(result.ok, true);
});

test(
  'seedAndVerifyDeclaredScenarios succeeds for real catalog scenarios',
  { timeout: 60_000 },
  async () => {
    const result = await seedAndVerifyDeclaredScenarios(['demo']);
    assert.deepEqual(result, { ok: true, errors: [] });
  },
);

test(
  'seedAndVerifyDeclaredScenarios fails with an actionable message for an unknown scenario',
  { timeout: 60_000 },
  async () => {
    const result = await seedAndVerifyDeclaredScenarios(['pillar/tenant/does-not-exist']);
    assert.equal(result.ok, false);
    assert.match(result.errors[0], /Unknown preview scenario/);
  },
);
