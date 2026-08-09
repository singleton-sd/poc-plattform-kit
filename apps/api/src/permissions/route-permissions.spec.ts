import {
  matchRoutePermission,
  PermissionMappingError,
  type RoutePermissionEntry,
} from './route-permissions';

describe('matchRoutePermission', () => {
  const entries: RoutePermissionEntry[] = [
    {
      id: 'tenant.patch-by-id',
      method: 'PATCH',
      path: '/tenants/:id',
      action: 'update',
      resourceType: 'tenant',
      resourceIdParam: 'id',
    },
    {
      id: 'tenant.read-platform',
      method: 'GET',
      path: '/tenants/platform',
      action: 'read',
      resourceType: 'tenant',
      resourceObjectId: 'platform',
    },
  ];

  it('maps a catalogued route to action + resource', () => {
    expect(
      matchRoutePermission(
        {
          method: 'patch',
          route: { path: '/tenants/:id' },
          params: { id: 't-1' },
        },
        entries,
      ),
    ).toEqual({ action: 'update', resource: 'tenant:t-1' });
  });

  it('fails closed when the id param is missing', () => {
    expect(() =>
      matchRoutePermission(
        {
          method: 'PATCH',
          route: { path: '/tenants/:id' },
          params: {},
        },
        entries,
      ),
    ).toThrow(PermissionMappingError);
  });

  it('maps parameterless routes via resourceObjectId', () => {
    expect(
      matchRoutePermission(
        { method: 'GET', route: { path: '/tenants/platform' }, params: {} },
        entries,
      ),
    ).toEqual({ action: 'read', resource: 'tenant:platform' });
  });

  it('returns null for unmapped routes', () => {
    expect(
      matchRoutePermission({ method: 'GET', route: { path: '/health' }, params: {} }, entries),
    ).toBeNull();
  });
});
