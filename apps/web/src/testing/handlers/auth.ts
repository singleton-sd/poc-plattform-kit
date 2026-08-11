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
 * Triggers the "Loading…" UI in HomeAuthGate.
 * Note: Uses 30 second delay instead of 'infinite' to allow Chromatic snapshots to capture.
 */
export const meLoadingHandlers = [
  http.get(mePath, async () => {
    await delay(30000);
    return meResponse(createMeFixture(meRegularUser));
  }),
];

/**
 * Session verification error: returns 500 Internal Server Error.
 * Simulates a temporary backend failure when checking session validity.
 * Triggers the error recovery UI in HomeAuthGate.
 */
export const meErrorHandlers = [
  http.get(mePath, () =>
    HttpResponse.json({ message: 'Session verification failed' }, { status: 500 }),
  ),
];

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
