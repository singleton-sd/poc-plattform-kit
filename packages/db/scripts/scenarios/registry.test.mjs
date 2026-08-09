import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DuplicateScenarioError,
  ScenarioConflictError,
  ScenarioCycleError,
  UnknownScenarioError,
  createScenarioRegistry,
} from './registry.mjs';

function baseScenario(name, overrides = {}) {
  return { name, seed: async () => {}, ...overrides };
}

test('define rejects a scenario without a seed function', () => {
  const registry = createScenarioRegistry();
  assert.throws(() => registry.define({ name: 'x' }), /seed\(prisma\) function/);
});

test('define rejects duplicate scenario names', () => {
  const registry = createScenarioRegistry();
  registry.define(baseScenario('pillar/tenant/a'));
  assert.throws(() => registry.define(baseScenario('pillar/tenant/a')), DuplicateScenarioError);
});

test('resolve returns dependencies before dependents, each scenario once', () => {
  const registry = createScenarioRegistry();
  registry.define(baseScenario('pillar/tenant/base'));
  registry.define(baseScenario('pillar/tenant/owner', { dependsOn: ['pillar/tenant/base'] }));
  registry.define(baseScenario('pillar/tenant/multi', { dependsOn: ['pillar/tenant/owner'] }));

  const resolved = registry.resolve(['pillar/tenant/multi']).map((s) => s.name);
  assert.deepEqual(resolved, ['pillar/tenant/base', 'pillar/tenant/owner', 'pillar/tenant/multi']);
});

test('resolve deduplicates a shared dependency requested via two scenarios', () => {
  const registry = createScenarioRegistry();
  registry.define(baseScenario('pillar/tenant/base'));
  registry.define(baseScenario('pillar/tenant/a', { dependsOn: ['pillar/tenant/base'] }));
  registry.define(baseScenario('pillar/tenant/b', { dependsOn: ['pillar/tenant/base'] }));

  const resolved = registry.resolve(['pillar/tenant/a', 'pillar/tenant/b']).map((s) => s.name);
  assert.deepEqual(resolved, ['pillar/tenant/base', 'pillar/tenant/a', 'pillar/tenant/b']);
});

test('resolve is deterministic regardless of requested order', () => {
  const registry = createScenarioRegistry();
  registry.define(baseScenario('pillar/tenant/base'));
  registry.define(baseScenario('pillar/tenant/a', { dependsOn: ['pillar/tenant/base'] }));
  registry.define(baseScenario('pillar/tenant/b', { dependsOn: ['pillar/tenant/base'] }));

  const first = registry.resolve(['pillar/tenant/a', 'pillar/tenant/b']).map((s) => s.name);
  const second = registry.resolve(['pillar/tenant/b', 'pillar/tenant/a']).map((s) => s.name);
  assert.deepEqual(first, second);
});

test('resolve throws UnknownScenarioError listing every registered name', () => {
  const registry = createScenarioRegistry();
  registry.define(baseScenario('pillar/tenant/a'));
  registry.define(baseScenario('pillar/tenant/b'));

  assert.throws(
    () => registry.resolve(['pillar/tenant/nope']),
    (error) => {
      assert.ok(error instanceof UnknownScenarioError);
      assert.deepEqual(error.knownNames, ['pillar/tenant/a', 'pillar/tenant/b']);
      assert.match(error.message, /pillar\/tenant\/a/);
      assert.match(error.message, /pillar\/tenant\/b/);
      return true;
    },
  );
});

test('resolve throws ScenarioCycleError for a direct cycle', () => {
  const registry = createScenarioRegistry();
  registry.define(baseScenario('pillar/tenant/a', { dependsOn: ['pillar/tenant/b'] }));
  registry.define(baseScenario('pillar/tenant/b', { dependsOn: ['pillar/tenant/a'] }));

  assert.throws(() => registry.resolve(['pillar/tenant/a']), ScenarioCycleError);
});

test('resolve throws ScenarioCycleError for a self-cycle', () => {
  const registry = createScenarioRegistry();
  registry.define(baseScenario('pillar/tenant/a', { dependsOn: ['pillar/tenant/a'] }));

  assert.throws(() => registry.resolve(['pillar/tenant/a']), ScenarioCycleError);
});

test('resolve throws ScenarioConflictError when two composed scenarios declare a conflict', () => {
  const registry = createScenarioRegistry();
  registry.define(baseScenario('pillar/tenant/a', { conflictsWith: ['pillar/tenant/b'] }));
  registry.define(baseScenario('pillar/tenant/b'));

  assert.throws(
    () => registry.resolve(['pillar/tenant/a', 'pillar/tenant/b']),
    ScenarioConflictError,
  );
});

test('resolve does not throw when a conflicting scenario is not actually requested', () => {
  const registry = createScenarioRegistry();
  registry.define(baseScenario('pillar/tenant/a', { conflictsWith: ['pillar/tenant/b'] }));
  registry.define(baseScenario('pillar/tenant/b'));

  const resolved = registry.resolve(['pillar/tenant/a']).map((s) => s.name);
  assert.deepEqual(resolved, ['pillar/tenant/a']);
});

test('list/listNames expose registered scenarios sorted by name', () => {
  const registry = createScenarioRegistry();
  registry.define(baseScenario('pillar/tenant/b'));
  registry.define(baseScenario('pillar/tenant/a'));

  assert.deepEqual(registry.listNames(), ['pillar/tenant/a', 'pillar/tenant/b']);
  assert.deepEqual(
    registry.list().map((s) => s.name),
    ['pillar/tenant/a', 'pillar/tenant/b'],
  );
});

test('a scenario without an explicit verify gets a default that reports ok', async () => {
  const registry = createScenarioRegistry();
  registry.define(baseScenario('pillar/tenant/a'));
  const result = await registry.get('pillar/tenant/a').verify();
  assert.equal(result.ok, true);
});
