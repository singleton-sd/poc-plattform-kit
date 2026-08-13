// The preview scenario catalog: every scenario available to
// PREVIEW_SEED_SCENARIOS, plus the "demo" baseline composition.
//
// createCatalog() returns a *fresh* registry each call (rather than a
// module-level singleton) so tests can build independent catalogs without
// tripping DuplicateScenarioError.
import { createScenarioRegistry } from './registry.mjs';
import { registerOutboxSafeScenarios } from './fixtures/outbox-safe.mjs';
import { registerTenantScenarios } from './fixtures/tenant.mjs';

const DEMO_SCENARIOS = [
  'pillar/tenant/empty',
  'pillar/tenant/multi-membership',
  'pillar/tenant/groups',
  'pillar/tenant/settings',
  'pillar/tenant/audit-history',
  'pillar/tenant/outbox-safe',
];

export function createCatalog() {
  const registry = createScenarioRegistry();

  registerTenantScenarios(registry);
  registerOutboxSafeScenarios(registry);

  registry.define({
    name: 'demo',
    description:
      'Baseline preview dataset: an empty/new tenant plus an active multi-role tenant with settings, audit history, and a safe outbox example. Default scenario set when PREVIEW_SEED_SCENARIOS is unset.',
    dependsOn: DEMO_SCENARIOS,
    testInstructions:
      'The default preview dataset — see each composed pillar/tenant/* scenario for specific test steps.',
    seed: async () => {
      // Composition-only: everything is seeded by the scenarios in dependsOn.
    },
    verify: async () => ({
      ok: true,
      message: 'composition-only: see the composed pillar/tenant/* scenarios for verification',
    }),
  });

  return registry;
}

export const DEFAULT_SCENARIOS = ['demo'];
