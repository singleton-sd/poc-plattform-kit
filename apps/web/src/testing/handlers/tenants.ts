import type { TenantListResponseDto } from '@poc-plattform-kit/api-client';
import { delay, http, HttpResponse } from 'msw';
import { createTenantFixtures, NO_RESULTS_QUERY } from '../fixtures/tenants';

const tenantsPath = '*/tenants';

function listResponse(items = createTenantFixtures()) {
  return HttpResponse.json<TenantListResponseDto>({ items, nextCursor: null });
}

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
