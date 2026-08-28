import { defineConfig } from '@neon/config/v1';

/**
 * Neon branch config for Platform Kit (PoC).
 *
 * Services in use today:
 * - Lakebase Postgres (`neondb`) — Prisma `packages/db` (tenant, pillars, outbox/audit)
 * - Lakebase Postgres (`openfga`) — OpenFGA authorization engine datastore (#293)
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
