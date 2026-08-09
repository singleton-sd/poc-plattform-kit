// Tenant pillar preview scenarios. All identities are synthetic — no real
// names, emails, or addresses — and every row uses an explicit deterministic
// id so re-seeding (registry-level idempotency) upserts the same rows
// instead of creating duplicates.
import { atOffsetMinutes } from '../timestamps.mjs';

const SYNTHETIC_DOMAIN = 'example.invalid';

async function upsertById(model, id, data) {
  return model.upsert({ where: { id }, create: { id, ...data }, update: data });
}

/** Registers the pillar/tenant/* scenarios on the given registry. */
export function registerTenantScenarios(registry) {
  registry.define({
    name: 'pillar/tenant/empty',
    description:
      'A brand-new tenant with zero memberships — the state right after tenant creation, before anyone has been invited.',
    testInstructions:
      'GET /tenants/seed-tenant-empty-co returns the tenant; its membership list is empty.',
    seed: async (prisma) => {
      await upsertById(prisma.tenant, 'seed-tenant-empty-co', {
        name: 'Seed Empty Co',
        slug: 'seed-empty-co',
        settings: null,
      });
    },
    verify: async (prisma) => {
      const tenant = await prisma.tenant.findUnique({ where: { id: 'seed-tenant-empty-co' } });
      if (!tenant) return { ok: false, message: 'seed-tenant-empty-co is missing' };
      const memberships = await prisma.tenantMembership.count({
        where: { tenantId: tenant.id },
      });
      return memberships === 0
        ? { ok: true, message: 'empty tenant has no memberships, as expected' }
        : { ok: false, message: `expected 0 memberships, found ${memberships}` };
    },
  });

  registry.define({
    name: 'pillar/tenant/owner',
    description:
      'An active tenant ("Seed Acme Rocketry") with a single owner membership — the state right after tenant creation via the normal signup flow.',
    testInstructions:
      'GET /tenants/seed-tenant-acme-rocketry returns the tenant; its membership list has exactly one "owner" row for seed-user-acme-owner.',
    seed: async (prisma) => {
      await upsertById(prisma.user, 'seed-user-acme-owner', {
        entraOid: 'seed-oid-acme-owner',
        email: `acme-owner@${SYNTHETIC_DOMAIN}`,
        name: 'Seed Acme Owner',
      });
      await upsertById(prisma.tenant, 'seed-tenant-acme-rocketry', {
        name: 'Seed Acme Rocketry',
        slug: 'seed-acme-rocketry',
        settings: null,
      });
      await upsertById(prisma.tenantMembership, 'seed-owner-membership', {
        tenantId: 'seed-tenant-acme-rocketry',
        userId: 'seed-user-acme-owner',
        role: 'owner',
      });
      await upsertById(prisma.tenantAudit, 'seed-owner-audit-created', {
        entityType: 'Tenant',
        entityId: 'seed-tenant-acme-rocketry',
        action: 'created',
        actorId: 'seed-user-acme-owner',
        changes: JSON.stringify({ name: 'Seed Acme Rocketry', slug: 'seed-acme-rocketry' }),
        createdAt: atOffsetMinutes(0),
      });
      // Already-delivered examples: previews never enable the real Service
      // Bus client (AZURE_SERVICEBUS_CONNECTION_STRING is unset), so nothing
      // here is ever drained — processedAt is set purely to demonstrate the
      // "already handled" outbox state. See pillar/tenant/outbox-safe for a
      // pending example.
      await upsertById(prisma.tenantOutbox, 'seed-owner-outbox-created', {
        eventType: 'tenant.created',
        payload: JSON.stringify({ id: 'seed-tenant-acme-rocketry', synthetic: true }),
        occurredAt: atOffsetMinutes(0),
        processedAt: atOffsetMinutes(1),
      });
      await upsertById(prisma.tenantOutbox, 'seed-owner-outbox-member-added', {
        eventType: 'tenant.member_added',
        payload: JSON.stringify({
          userId: 'seed-user-acme-owner',
          role: 'owner',
          synthetic: true,
        }),
        occurredAt: atOffsetMinutes(0),
        processedAt: atOffsetMinutes(1),
      });
    },
    verify: async (prisma) => {
      const membership = await prisma.tenantMembership.findUnique({
        where: { id: 'seed-owner-membership' },
      });
      return membership?.role === 'owner'
        ? { ok: true, message: 'owner membership present' }
        : { ok: false, message: 'seed-owner-membership missing or wrong role' };
    },
  });

  registry.define({
    name: 'pillar/tenant/multi-membership',
    description:
      'Seed Acme Rocketry with three memberships (owner, admin, member) — exercises per-tenant role variety and membership listing.',
    dependsOn: ['pillar/tenant/owner'],
    testInstructions:
      'GET /tenants/seed-tenant-acme-rocketry memberships include owner, admin, and member roles (3 distinct users).',
    seed: async (prisma) => {
      await upsertById(prisma.user, 'seed-user-acme-admin', {
        entraOid: 'seed-oid-acme-admin',
        email: `acme-admin@${SYNTHETIC_DOMAIN}`,
        name: 'Seed Acme Admin',
      });
      await upsertById(prisma.user, 'seed-user-acme-member', {
        entraOid: 'seed-oid-acme-member',
        email: `acme-member@${SYNTHETIC_DOMAIN}`,
        name: 'Seed Acme Member',
      });
      await upsertById(prisma.tenantMembership, 'seed-multi-membership-admin', {
        tenantId: 'seed-tenant-acme-rocketry',
        userId: 'seed-user-acme-admin',
        role: 'admin',
      });
      await upsertById(prisma.tenantMembership, 'seed-multi-membership-member', {
        tenantId: 'seed-tenant-acme-rocketry',
        userId: 'seed-user-acme-member',
        role: 'member',
      });
      await upsertById(prisma.tenantAudit, 'seed-multi-audit-admin-added', {
        entityType: 'Tenant',
        entityId: 'seed-tenant-acme-rocketry',
        action: 'member_added',
        actorId: 'seed-user-acme-owner',
        changes: JSON.stringify({ userId: 'seed-user-acme-admin', role: 'admin' }),
        createdAt: atOffsetMinutes(5),
      });
      await upsertById(prisma.tenantAudit, 'seed-multi-audit-member-added', {
        entityType: 'Tenant',
        entityId: 'seed-tenant-acme-rocketry',
        action: 'member_added',
        actorId: 'seed-user-acme-owner',
        changes: JSON.stringify({ userId: 'seed-user-acme-member', role: 'member' }),
        createdAt: atOffsetMinutes(6),
      });
    },
    verify: async (prisma) => {
      const roles = await prisma.tenantMembership.findMany({
        where: { tenantId: 'seed-tenant-acme-rocketry' },
        select: { role: true },
      });
      const distinct = new Set(roles.map((r) => r.role));
      return distinct.size === 3
        ? { ok: true, message: '3 distinct roles present (owner, admin, member)' }
        : { ok: false, message: `expected 3 distinct roles, found ${[...distinct].join(',')}` };
    },
  });

  registry.define({
    name: 'pillar/tenant/settings',
    description:
      'Seed Acme Rocketry with representative tenant settings populated — the "tenant has configured preferences" state.',
    dependsOn: ['pillar/tenant/owner'],
    testInstructions:
      'GET /tenants/seed-tenant-acme-rocketry returns settings with theme "light" and a support email.',
    seed: async (prisma) => {
      const settings = JSON.stringify({
        theme: 'light',
        locale: 'en-US',
        supportEmail: `support@${SYNTHETIC_DOMAIN}`,
      });
      await prisma.tenant.update({
        where: { id: 'seed-tenant-acme-rocketry' },
        data: { settings },
      });
      await upsertById(prisma.tenantAudit, 'seed-settings-audit-updated', {
        entityType: 'Tenant',
        entityId: 'seed-tenant-acme-rocketry',
        action: 'updated',
        actorId: 'seed-user-acme-owner',
        changes: JSON.stringify({ settings }),
        createdAt: atOffsetMinutes(10),
      });
    },
    verify: async (prisma) => {
      const tenant = await prisma.tenant.findUnique({
        where: { id: 'seed-tenant-acme-rocketry' },
      });
      const settings = tenant?.settings ? JSON.parse(tenant.settings) : null;
      return settings?.theme === 'light'
        ? { ok: true, message: 'tenant settings populated' }
        : { ok: false, message: 'tenant settings missing or unexpected' };
    },
  });

  registry.define({
    name: 'pillar/tenant/audit-history',
    description:
      'Seed Acme Rocketry with a realistic multi-step audit timeline (creation, membership changes, a role change) — the "reviewing history" state.',
    dependsOn: ['pillar/tenant/owner'],
    testInstructions:
      'GET the tenant audit trail for seed-tenant-acme-rocketry (once exposed via an API) and see 5+ chronological entries.',
    seed: async (prisma) => {
      await upsertById(prisma.tenantAudit, 'seed-audit-history-member-added-admin', {
        entityType: 'Tenant',
        entityId: 'seed-tenant-acme-rocketry',
        action: 'member_added',
        actorId: 'seed-user-acme-owner',
        changes: JSON.stringify({ userId: 'seed-user-acme-admin', role: 'admin' }),
        createdAt: atOffsetMinutes(20),
      });
      await upsertById(prisma.tenantAudit, 'seed-audit-history-settings-updated', {
        entityType: 'Tenant',
        entityId: 'seed-tenant-acme-rocketry',
        action: 'updated',
        actorId: 'seed-user-acme-owner',
        changes: JSON.stringify({ settings: { theme: 'light' } }),
        createdAt: atOffsetMinutes(25),
      });
      await upsertById(prisma.tenantAudit, 'seed-audit-history-role-changed', {
        entityType: 'Tenant',
        entityId: 'seed-tenant-acme-rocketry',
        action: 'membership_role_changed',
        actorId: 'seed-user-acme-owner',
        changes: JSON.stringify({
          userId: 'seed-user-acme-admin',
          from: 'member',
          to: 'admin',
        }),
        createdAt: atOffsetMinutes(30),
      });
    },
    verify: async (prisma) => {
      const count = await prisma.tenantAudit.count({
        where: { entityId: 'seed-tenant-acme-rocketry' },
      });
      return count >= 4
        ? { ok: true, message: `${count} audit entries present` }
        : { ok: false, message: `expected at least 4 audit entries, found ${count}` };
    },
  });

  registry.define({
    name: 'pillar/tenant/outbox-safe',
    description:
      'Seed Acme Rocketry with one already-processed and one still-pending TenantOutbox row — demonstrates outbox state without ever reaching a real consumer (previews never enable the Service Bus client).',
    dependsOn: ['pillar/tenant/owner'],
    testInstructions:
      'Inspect the tenant_outbox table (or a future admin endpoint): one row has processedAt set, one does not, both are marked synthetic in their payload.',
    seed: async (prisma) => {
      await upsertById(prisma.tenantOutbox, 'seed-tenant-outbox-safe-processed', {
        eventType: 'tenant.preview_seed_example',
        payload: JSON.stringify({ synthetic: true, note: 'preview scenario fixture' }),
        occurredAt: atOffsetMinutes(40),
        processedAt: atOffsetMinutes(41),
      });
      await upsertById(prisma.tenantOutbox, 'seed-tenant-outbox-safe-pending', {
        eventType: 'tenant.preview_seed_example',
        payload: JSON.stringify({ synthetic: true, note: 'preview scenario fixture' }),
        occurredAt: atOffsetMinutes(42),
        processedAt: null,
      });
    },
    verify: async (prisma) => {
      const [processed, pending] = await Promise.all([
        prisma.tenantOutbox.findUnique({ where: { id: 'seed-tenant-outbox-safe-processed' } }),
        prisma.tenantOutbox.findUnique({ where: { id: 'seed-tenant-outbox-safe-pending' } }),
      ]);
      if (!processed?.processedAt) return { ok: false, message: 'processed example missing' };
      if (pending?.processedAt) return { ok: false, message: 'pending example was not pending' };
      return { ok: true, message: 'one processed and one pending safe outbox row present' };
    },
  });
}
