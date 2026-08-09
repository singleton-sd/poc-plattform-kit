import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_SCENARIOS_CSV,
  parsePreviewScenarioDeclaration,
  resolveBuildScenarios,
} from './parse-preview-scenarios.mjs';

test('parsePreviewScenarioDeclaration returns "unset" for a body without a declaration', () => {
  assert.deepEqual(parsePreviewScenarioDeclaration('Just a normal PR description.'), {
    kind: 'unset',
  });
});

test('parsePreviewScenarioDeclaration returns "unset" for an empty/undefined body', () => {
  assert.deepEqual(parsePreviewScenarioDeclaration(''), { kind: 'unset' });
  assert.deepEqual(parsePreviewScenarioDeclaration(undefined), { kind: 'unset' });
});

test('parsePreviewScenarioDeclaration parses a comma-separated scenario list', () => {
  const body = 'Some text.\n<!-- preview-scenarios: pillar/tenant/settings, pillar/x/y -->\nMore.';
  assert.deepEqual(parsePreviewScenarioDeclaration(body), {
    kind: 'scenarios',
    names: ['pillar/tenant/settings', 'pillar/x/y'],
  });
});

test('parsePreviewScenarioDeclaration is case-insensitive and tolerates extra whitespace', () => {
  const body = '<!--   PREVIEW-SCENARIOS:   demo  -->';
  assert.deepEqual(parsePreviewScenarioDeclaration(body), {
    kind: 'scenarios',
    names: ['demo'],
  });
});

test('parsePreviewScenarioDeclaration returns "empty" for a present-but-blank list', () => {
  assert.deepEqual(parsePreviewScenarioDeclaration('<!-- preview-scenarios:  -->'), {
    kind: 'empty',
  });
});

test('parsePreviewScenarioDeclaration parses a not-applicable exemption with its reason', () => {
  const body = '<!-- preview-scenario: not-applicable: docs-only change -->';
  assert.deepEqual(parsePreviewScenarioDeclaration(body), {
    kind: 'not-applicable',
    reason: 'docs-only change',
  });
});

test('a not-applicable declaration takes precedence over a scenarios declaration', () => {
  const body =
    '<!-- preview-scenario: not-applicable: infra only --><!-- preview-scenarios: demo -->';
  assert.deepEqual(parsePreviewScenarioDeclaration(body), {
    kind: 'not-applicable',
    reason: 'infra only',
  });
});

test('resolveBuildScenarios joins a scenarios declaration into CSV', () => {
  assert.equal(
    resolveBuildScenarios({ kind: 'scenarios', names: ['demo', 'pillar/tenant/settings'] }),
    'demo,pillar/tenant/settings',
  );
});

test('resolveBuildScenarios falls back to the default for unset/empty/not-applicable', () => {
  assert.equal(resolveBuildScenarios({ kind: 'unset' }), DEFAULT_SCENARIOS_CSV);
  assert.equal(resolveBuildScenarios({ kind: 'empty' }), DEFAULT_SCENARIOS_CSV);
  assert.equal(
    resolveBuildScenarios({ kind: 'not-applicable', reason: 'docs only' }),
    DEFAULT_SCENARIOS_CSV,
  );
});
