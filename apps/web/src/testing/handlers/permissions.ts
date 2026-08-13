import type {
  AccessRequestListResponseDto,
  AccessRequestResponseDto,
  CheckPermissionResponseDto,
} from '@poc-plattform-kit/api-client';
import { delay, http, HttpResponse } from 'msw';
import {
  CREATE_ACCESS_REQUEST_400_MESSAGE,
  OPENFGA_UNAVAILABLE_MESSAGE,
  createApprovingAccessRequest,
  createCheckAllowedFixture,
  createCheckDeniedFixture,
  createDeniedAccessRequest,
  createExpiredAccessRequest,
  createPendingAccessRequest,
} from '../fixtures/permissions';

const checkPath = '*/permissions/check';
const minePath = '*/permissions/access-requests/mine';
const createPath = '*/permissions/access-requests';

function checkResponse(allowed: boolean) {
  const body: CheckPermissionResponseDto = allowed
    ? createCheckAllowedFixture()
    : createCheckDeniedFixture();
  return HttpResponse.json(body);
}

function mineResponse(items: AccessRequestResponseDto[]) {
  const body: AccessRequestListResponseDto = { items };
  return HttpResponse.json(body);
}

function deniedCheckHandler() {
  return http.post(checkPath, () => checkResponse(false));
}

/**
 * Loading state: delayed Check keeps PermissionGate on "Checking access…".
 * Mine is not requested until Check returns denied.
 */
export const permissionsCheckLoadingHandlers = [
  http.post(checkPath, async () => {
    await delay('infinite');
    return checkResponse(true);
  }),
];

/** Allowed Check: children render; mine is not requested. */
export const permissionsAllowedHandlers = [http.post(checkPath, () => checkResponse(true))];

/** Denied Check with an empty mine list: Request access CTA is available. */
export const permissionsDeniedEmptyHandlers = [
  deniedCheckHandler(),
  http.get(minePath, () => mineResponse([])),
];

/** Denied Check with a pending access request: status only, no CTA. */
export const permissionsPendingHandlers = [
  deniedCheckHandler(),
  http.get(minePath, () => mineResponse([createPendingAccessRequest()])),
];

/** Denied Check with an approving access request: status only, no CTA. */
export const permissionsApprovingHandlers = [
  deniedCheckHandler(),
  http.get(minePath, () => mineResponse([createApprovingAccessRequest()])),
];

/** Denied Check whose latest request was denied: CTA returns. */
export const permissionsLastDeniedHandlers = [
  deniedCheckHandler(),
  http.get(minePath, () => mineResponse([createDeniedAccessRequest()])),
];

/** Denied Check whose latest request expired: CTA returns. */
export const permissionsLastExpiredHandlers = [
  deniedCheckHandler(),
  http.get(minePath, () => mineResponse([createExpiredAccessRequest()])),
];

/**
 * Check error: Nest 500 with OpenFGA unavailable.
 * Triggers PermissionGate retry UI via formatApiError.
 */
export const permissionsCheckErrorHandlers = [
  http.post(checkPath, () =>
    HttpResponse.json({ message: OPENFGA_UNAVAILABLE_MESSAGE }, { status: 500 }),
  ),
];

/**
 * Check network failure alternative (React Query isError without Nest body).
 * Prefer `permissionsCheckErrorHandlers` for the snapshot of Nest message copy.
 */
export const permissionsCheckNetworkErrorHandlers = [
  http.post(checkPath, () => HttpResponse.error()),
];

/** Denied empty mine plus create 400 Nest `{ message }`. */
export const permissionsCreate400Handlers = [
  deniedCheckHandler(),
  http.get(minePath, () => mineResponse([])),
  http.post(createPath, () =>
    HttpResponse.json({ message: CREATE_ACCESS_REQUEST_400_MESSAGE }, { status: 400 }),
  ),
];
