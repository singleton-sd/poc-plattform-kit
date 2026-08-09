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
  const body = 'Some text.\nPreview scenarios: pillar/tenant/settings, pillar/x/y\nMore.';
  assert.deepEqual(parsePreviewScenarioDeclaration(body), {
    kind: 'scenarios',
    names: ['pillar/tenant/settings', 'pillar/x/y'],
  });
});

test('parsePreviewScenarioDeclaration is case-insensitive, accepts a hyphenated label, and tolerates extra whitespace', () => {
  const body = '   Preview-Scenarios:   demo  ';
  assert.deepEqual(parsePreviewScenarioDeclaration(body), {
    kind: 'scenarios',
    names: ['demo'],
  });
});

test('parsePreviewScenarioDeclaration returns "empty" for a present-but-blank list', () => {
  assert.deepEqual(parsePreviewScenarioDeclaration('Preview scenarios: '), {
    kind: 'empty',
  });
});

test('parsePreviewScenarioDeclaration parses a not-applicable exemption with its reason (colon separator)', () => {
  const body = 'Preview scenarios: not-applicable: docs-only change';
  assert.deepEqual(parsePreviewScenarioDeclaration(body), {
    kind: 'not-applicable',
    reason: 'docs-only change',
  });
});

test('parsePreviewScenarioDeclaration parses a not-applicable exemption with an em-dash separator', () => {
  const body = 'Preview scenarios: not-applicable — CI workflow tweak only';
  assert.deepEqual(parsePreviewScenarioDeclaration(body), {
    kind: 'not-applicable',
    reason: 'CI workflow tweak only',
  });
});

test('parsePreviewScenarioDeclaration only looks at the declaration line, not the whole body', () => {
  const body = [
    'This PR is not-applicable for review by anyone.',
    'Preview scenarios: pillar/tenant/settings',
  ].join('\n');
  assert.deepEqual(parsePreviewScenarioDeclaration(body), {
    kind: 'scenarios',
    names: ['pillar/tenant/settings'],
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
