import type { Me } from '@/features/auth/me';

export const FIXED_NOW = '2026-01-15T10:30:00.000Z';

/**
 * Mock user: regular tenant user with no elevated roles.
 * Used for basic sign-in scenarios and permission-restricted features.
 */
export const meRegularUser = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'alice@example.com',
  name: 'Alice Johnson',
  roles: [],
} as const satisfies Me;

/**
 * Mock user: support agent with the support-agent role.
 * Used for support-team-only features and escalation workflows.
 */
export const meSupportAgent = {
  id: '00000000-0000-4000-8000-000000000002',
  email: 'bob.support@example.com',
  name: 'Bob Support',
  roles: ['support-agent'],
} as const satisfies Me;

/**
 * Mock user: tenant admin with the tenant-admin role.
 * Used for tenant management and administrative workflows.
 */
export const meTenantAdmin = {
  id: '00000000-0000-4000-8000-000000000003',
  email: 'carol.admin@example.com',
  name: 'Carol Admin',
  roles: ['tenant-admin'],
} as const satisfies Me;

/**
 * Mock user: has both support-agent and tenant-admin roles.
 * Used for testing multi-role authorization scenarios.
 */
export const meMultipleRoles = {
  id: '00000000-0000-4000-8000-000000000004',
  email: 'david.multi@example.com',
  name: 'David Multi-Role',
  roles: ['support-agent', 'tenant-admin'],
} as const satisfies Me;

/**
 * Marker for unauthenticated / signed-out state.
 * Represented as null in fetchMe() and useMe() contract.
 */
export const meSignedOut = null;

/**
 * Fixture factory: returns a fresh copy of the given user state.
 * Prevents story mutations from leaking into other scenarios.
 */
export function createMeFixture(me: Me | null): Me | null {
  if (me === null) return null;
  return {
    id: me.id,
    email: me.email,
    name: me.name,
    roles: [...me.roles],
  };
}
