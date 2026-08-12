import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCatalog, DEFAULT_SCENARIOS } from './catalog.mjs';

const NAME_PATTERN = /^(demo|(pillar|feature|bug)\/[a-z0-9-]+\/[a-z0-9-]+)$/;

test('createCatalog builds without throwing and every scenario name follows the naming convention', () => {
  const catalog = createCatalog();
  const names = catalog.listNames();
  assert.ok(names.length > 0);
  for (const name of names) {
    assert.match(name, NAME_PATTERN, `"${name}" does not follow the naming convention`);
  }
});

test('createCatalog returns an independent registry each call', () => {
  // Would throw DuplicateScenarioError if catalog.mjs used a module-level
  // singleton registry instead of building fresh state per call.
  assert.doesNotThrow(() => {
    createCatalog();
    createCatalog();
  });
});

test('the default scenario set ("demo") resolves without error', () => {
  const catalog = createCatalog();
  const resolved = catalog.resolve(DEFAULT_SCENARIOS);
  assert.ok(resolved.some((s) => s.name === 'demo'));
  assert.ok(resolved.some((s) => s.name === 'pillar/tenant/owner'));
});

test('every registered pillar has at least one scenario', () => {
  const catalog = createCatalog();
  const pillars = [
    'tenant',
    'single-sign-on',
    'subscriptions',
    'contact',
    'support',
    'permissions',
    'notifications',
    'audit',
    'reporting',
  ];
  for (const pillar of pillars) {
    const hasScenario = catalog.listNames().some((name) => name.startsWith(`pillar/${pillar}/`));
    assert.ok(hasScenario, `no scenario registered for pillar "${pillar}"`);
  }
});

test('an unknown scenario name fails with the full supported list', () => {
  const catalog = createCatalog();
  assert.throws(
    () => catalog.resolve(['pillar/tenant/does-not-exist']),
    (error) => {
      assert.match(error.message, /Unknown preview scenario/);
      assert.ok(error.knownNames.includes('demo'));
      return true;
    },
  );
});
