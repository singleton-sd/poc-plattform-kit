// Generic "outbox-safe" scenario for pillars that currently only have an
// Outbox scaffold (no domain models yet — see AGENTS.md: domain entities
// land with each pillar's own foundation ticket). Demonstrates the
// pending/processed outbox shape without inventing product behaviour the
// pillar doesn't have, and without ever risking delivery to a real
// consumer: previews never set AZURE_SERVICEBUS_CONNECTION_STRING, so
// OutboxDrainerService stays disabled regardless of what's seeded here.
import { atOffsetMinutes } from '../timestamps.mjs';

// { pillar: kebab-case name for the scenario, model: Prisma client accessor }
export const OUTBOX_ONLY_PILLARS = [
  { pillar: 'single-sign-on', model: 'singleSignOnOutbox' },
  { pillar: 'subscriptions', model: 'subscriptionsOutbox' },
  { pillar: 'contact', model: 'contactOutbox' },
  { pillar: 'support', model: 'supportOutbox' },
  { pillar: 'permissions', model: 'permissionsOutbox' },
  { pillar: 'notifications', model: 'notificationsOutbox' },
  { pillar: 'audit', model: 'auditOutbox' },
  { pillar: 'reporting', model: 'reportingOutbox' },
];

async function upsertById(model, id, data) {
  return model.upsert({ where: { id }, create: { id, ...data }, update: data });
}

/** Registers pillar/<pillar>/outbox-safe for every pillar in OUTBOX_ONLY_PILLARS. */
export function registerOutboxSafeScenarios(registry) {
  for (const { pillar, model } of OUTBOX_ONLY_PILLARS) {
    const processedId = `seed-${pillar}-outbox-safe-processed`;
    const pendingId = `seed-${pillar}-outbox-safe-pending`;

    registry.define({
      name: `pillar/${pillar}/outbox-safe`,
      description: `${pillar}: one already-processed and one still-pending synthetic outbox row. This pillar has no domain models yet beyond its Outbox/Audit scaffold (see AGENTS.md).`,
      testInstructions: `Inspect the ${pillar.replace(/-/g, '_')}_outbox table: ${processedId} has processedAt set, ${pendingId} does not; both payloads are marked synthetic.`,
      seed: async (prisma) => {
        await upsertById(prisma[model], processedId, {
          eventType: `${pillar}.preview_seed_example`,
          payload: JSON.stringify({ synthetic: true, note: 'preview scenario fixture' }),
          occurredAt: atOffsetMinutes(0),
          processedAt: atOffsetMinutes(1),
        });
        await upsertById(prisma[model], pendingId, {
          eventType: `${pillar}.preview_seed_example`,
          payload: JSON.stringify({ synthetic: true, note: 'preview scenario fixture' }),
          occurredAt: atOffsetMinutes(2),
          processedAt: null,
        });
      },
      verify: async (prisma) => {
        const [processed, pending] = await Promise.all([
          prisma[model].findUnique({ where: { id: processedId } }),
          prisma[model].findUnique({ where: { id: pendingId } }),
        ]);
        if (!processed?.processedAt) return { ok: false, message: `${processedId} missing` };
        if (pending?.processedAt) return { ok: false, message: `${pendingId} was not pending` };
        return { ok: true, message: `${pillar} outbox-safe rows present` };
      },
    });
  }
}
