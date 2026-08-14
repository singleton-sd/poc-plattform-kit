import type { TenantListResponseDto, TenantResponseDto } from '@poc-plattform-kit/api-client';
import { delay, http, HttpResponse } from 'msw';
import { createTenantFixtures, NO_RESULTS_QUERY, tenantFixtures } from '../fixtures/tenants';

const tenantsPath = '*/tenants';
const tenantByIdPath = '*/tenants/:id';

function listResponse(items = createTenantFixtures()) {
  return HttpResponse.json<TenantListResponseDto>({ items, nextCursor: null });
}

function findOneResponse(tenant: TenantResponseDto) {
  return HttpResponse.json(tenant);
}

/**
 * Find-one for TenantDetailsDrawer stories.
 * Returns the fixture matching `:id`, or 404 when unknown.
 */
export const tenantsFindOneHandlers = [
  http.get(tenantByIdPath, ({ params }) => {
    const rawId = params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    const tenant = createTenantFixtures().find((entry) => entry.id === id);
    if (!tenant) {
      return HttpResponse.json({ message: 'Tenant not found' }, { status: 404 });
    }
    return findOneResponse(tenant);
  }),
];

/** Stable id for drawer stories that open Example North. */
export const DETAILS_DRAWER_TENANT_ID = tenantFixtures[0].id;

export const tenantsPopulatedHandlers = [
  http.get(tenantsPath, ({ request }) => {
    const query = new URL(request.url).searchParams.get('q')?.toLocaleLowerCase('en-GB');
    const tenants = createTenantFixtures();
    if (!query) return listResponse(tenants);
    return listResponse(
      tenants.filter(
        (tenant) =>
          tenant.name.toLocaleLowerCase('en-GB').includes(query) || tenant.slug.includes(query),
      ),
    );
  }),
];

export const tenantsCollectionEmptyHandlers = [http.get(tenantsPath, () => listResponse([]))];

export const tenantsSearchNoResultsHandlers = [
  http.get(tenantsPath, ({ request }) => {
    const query = new URL(request.url).searchParams.get('q');
    return query === NO_RESULTS_QUERY ? listResponse([]) : listResponse();
  }),
];

export const tenantsLoadingHandlers = [
  http.get(tenantsPath, async () => {
    await delay('infinite');
    return listResponse();
  }),
];

export const tenantsServerErrorHandlers = [
  http.get(tenantsPath, () =>
    HttpResponse.json({ message: 'Deterministic tenant service failure' }, { status: 500 }),
  ),
];

export const tenantsPermissionDeniedHandlers = [
  http.get(tenantsPath, () =>
    HttpResponse.json({ message: 'Tenant access is restricted' }, { status: 403 }),
  ),
];
