import { defineConfig } from '@neon/config/v1';

/**
 * Neon branch config for Platform Kit (PoC).
 *
 * Services in use today:
 * - Lakebase Postgres — Prisma `packages/db` (tenant, pillars, outbox/audit)
 *
 * OpenFGA/Permissions still runs on Azure ACA SQLite (#293); add a second
 * Postgres database here when that migration lands.
 */
export default defineConfig({
  branch: (branch) => {
    if (branch.exists) {
      return {};
    }
    if (branch.name === 'main' || branch.isDefault) {
      return {};
    }
    if (branch.name.startsWith('dev-') || branch.name.startsWith('preview-')) {
      return {
        ttl: '7d',
        postgres: {
          computeSettings: {
            autoscalingLimitMinCu: 0.25,
            autoscalingLimitMaxCu: 1,
            suspendTimeout: '5m',
          },
        },
      };
    }
    return {};
  },
});
