import type { TenantResponseDto } from '@poc-plattform-kit/api-client';

export const FIXED_NOW = '2026-01-15T10:30:00.000Z';
export const NO_RESULTS_QUERY = 'no-matching-tenant';

export const tenantFixtures = [
  {
    id: '00000000-0000-4000-8000-000000000101',
    name: 'Example North',
    slug: 'example-north',
    settings: { locale: 'en-GB' },
    createdAt: '2025-09-10T08:00:00.000Z',
    updatedAt: FIXED_NOW,
  },
  {
    id: '00000000-0000-4000-8000-000000000102',
    name: 'Example South',
    slug: 'example-south',
    settings: { locale: 'en-GB' },
    createdAt: '2025-10-20T09:15:00.000Z',
    updatedAt: '2026-01-12T14:45:00.000Z',
  },
] as const satisfies readonly TenantResponseDto[];

/** Fresh copies keep story mutations from leaking into another scenario. */
export function createTenantFixtures(): TenantResponseDto[] {
  return tenantFixtures.map((tenant) => ({
    ...tenant,
    settings: tenant.settings ? { ...tenant.settings } : tenant.settings,
  }));
}
