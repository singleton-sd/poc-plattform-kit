import { delay, http, HttpResponse } from 'msw';
import type { Me } from '@/features/auth/me';
import {
  createMeFixture,
  meRegularUser,
  meSupportAgent,
  meTenantAdmin,
  meMultipleRoles,
} from '../fixtures/auth';

const mePath = '*/api/me';

function meResponse(me: Me | null) {
  if (me === null) {
    return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
  return HttpResponse.json<Me>(me);
}

/**
 * Signed-out state: returns 401 Unauthorized.
 * Represents a user who has not yet authenticated or whose session has expired.
 */
export const meSignedOutHandlers = [http.get(mePath, () => meResponse(createMeFixture(null)))];

/**
 * Loading state: delayed response simulates a pending session verification.
 * Triggers the "Loading…" UI in AuthenticationGuard / HomeAuthGate.
 * Uses infinite delay to keep the UI in a stable loading state for deterministic snapshots.
 */
export const meLoadingHandlers = [
  http.get(mePath, async () => {
    await delay('infinite');
    return meResponse(createMeFixture(meRegularUser));
  }),
];

/**
 * Session verification error: simulates a network failure during session check.
 * Causes `fetch()` to reject, setting `isError` in React Query for error recovery UI.
 * Triggers the error recovery UI in AuthenticationGuard / HomeAuthGate.
 */
export const meErrorHandlers = [http.get(mePath, () => HttpResponse.error())];

/**
 * Signed-in state: returns a regular user with no elevated roles.
 * Demonstrates the basic authenticated user scenario.
 */
export const meSignedInHandlers = [
  http.get(mePath, () => meResponse(createMeFixture(meRegularUser))),
];

/**
 * Signed-in state: returns a user with the support-agent role.
 * Demonstrates role-based access for support features.
 */
export const meSupportAgentHandlers = [
  http.get(mePath, () => meResponse(createMeFixture(meSupportAgent))),
];

/**
 * Signed-in state: returns a user with the tenant-admin role.
 * Demonstrates role-based access for tenant management features.
 */
export const meTenantAdminHandlers = [
  http.get(mePath, () => meResponse(createMeFixture(meTenantAdmin))),
];

/**
 * Signed-in state: returns a user with multiple roles (support-agent + tenant-admin).
 * Demonstrates role composition and feature access with combined permissions.
 */
export const meMultipleRolesHandlers = [
  http.get(mePath, () => meResponse(createMeFixture(meMultipleRoles))),
];
