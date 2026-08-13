import type {
  AccessRequestListResponseDto,
  AccessRequestResponseDto,
  CheckPermissionResponseDto,
} from '@poc-plattform-kit/api-client';

export const FIXED_NOW = '2026-01-15T10:30:00.000Z';
export const GATE_ACTION = 'update';
export const GATE_RESOURCE = 'tenant:t1';
export const GATE_TENANT_ID = 't1';
export const OPENFGA_UNAVAILABLE_MESSAGE = 'OpenFGA unavailable';
export const CREATE_ACCESS_REQUEST_400_MESSAGE = 'preferredGrantExpiresAt is required';

export const checkAllowedFixture = {
  allowed: true,
} as const satisfies CheckPermissionResponseDto;

export const checkDeniedFixture = {
  allowed: false,
} as const satisfies CheckPermissionResponseDto;

const requestBase = {
  tenantId: '00000000-0000-4000-8000-000000000101',
  requesterId: '00000000-0000-4000-8000-000000000001',
  requesterEntraOid: '00000000-0000-4000-8000-000000000011',
  action: GATE_ACTION,
  resource: GATE_RESOURCE,
  preferredGrantType: 'permanent',
  createdAt: '2026-01-10T09:00:00.000Z',
  updatedAt: FIXED_NOW,
} as const;

export const pendingAccessRequest = {
  ...requestBase,
  id: '00000000-0000-4000-8000-000000000201',
  status: 'pending',
  requestExpiresAt: '2026-02-01T09:00:00.000Z',
} as const satisfies AccessRequestResponseDto;

export const approvingAccessRequest = {
  ...requestBase,
  id: '00000000-0000-4000-8000-000000000202',
  status: 'approving',
  requestExpiresAt: '2026-02-01T09:00:00.000Z',
} as const satisfies AccessRequestResponseDto;

export const deniedAccessRequest = {
  ...requestBase,
  id: '00000000-0000-4000-8000-000000000203',
  status: 'denied',
  decidedById: '00000000-0000-4000-8000-000000000003',
  decidedAt: '2026-01-12T11:00:00.000Z',
  denyReason: 'Not required for this role',
} as const satisfies AccessRequestResponseDto;

export const expiredAccessRequest = {
  ...requestBase,
  id: '00000000-0000-4000-8000-000000000204',
  status: 'expired',
  requestExpiresAt: '2026-01-14T09:00:00.000Z',
} as const satisfies AccessRequestResponseDto;

export const createAccessRequest400Body = {
  message: CREATE_ACCESS_REQUEST_400_MESSAGE,
} as const;

export const checkErrorBody = {
  message: OPENFGA_UNAVAILABLE_MESSAGE,
} as const;

/** Fresh copies keep story mutations from leaking into another scenario. */
export function createCheckAllowedFixture(): CheckPermissionResponseDto {
  return { ...checkAllowedFixture };
}

export function createCheckDeniedFixture(): CheckPermissionResponseDto {
  return { ...checkDeniedFixture };
}

export function createPendingAccessRequest(): AccessRequestResponseDto {
  return { ...pendingAccessRequest };
}

export function createApprovingAccessRequest(): AccessRequestResponseDto {
  return { ...approvingAccessRequest };
}

export function createDeniedAccessRequest(): AccessRequestResponseDto {
  return { ...deniedAccessRequest };
}

export function createExpiredAccessRequest(): AccessRequestResponseDto {
  return { ...expiredAccessRequest };
}

export function createMineEmptyList(): AccessRequestListResponseDto {
  return { items: [] };
}

export function createMinePendingList(): AccessRequestListResponseDto {
  return { items: [createPendingAccessRequest()] };
}

export function createMineApprovingList(): AccessRequestListResponseDto {
  return { items: [createApprovingAccessRequest()] };
}

export function createMineLastDeniedList(): AccessRequestListResponseDto {
  return { items: [createDeniedAccessRequest()] };
}

export function createMineLastExpiredList(): AccessRequestListResponseDto {
  return { items: [createExpiredAccessRequest()] };
}

export function createCheckErrorBody(): { message: string } {
  return { ...checkErrorBody };
}

export function createAccessRequest400ErrorBody(): { message: string } {
  return { ...createAccessRequest400Body };
}
