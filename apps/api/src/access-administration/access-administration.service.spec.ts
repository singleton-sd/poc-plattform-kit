import { ForbiddenException } from '@nestjs/common';
import type { PermissionsService } from '@poc-plattform-kit/pillar-permissions';
import type { UserIdentityService } from '@poc-plattform-kit/pillar-single-sign-on';
import type { TenancyContext, TenantService } from '@poc-plattform-kit/pillar-tenant';
import { AccessAdministrationService } from './access-administration.service';
import type { TenantGroupAccessReader } from './tenant-group-access.reader';

describe('AccessAdministrationService', () => {
  const permissions = {
    check: jest.fn(),
    listResourceTuples: jest.fn(),
  } as unknown as PermissionsService;
  const tenants = { listMemberships: jest.fn() } as unknown as TenantService;
  const identities = { findDisplayRecords: jest.fn() } as unknown as UserIdentityService;
  const groups = { listMemberships: jest.fn() } as unknown as TenantGroupAccessReader;
  const tenancy = { getTenantId: jest.fn() } as unknown as TenancyContext;
  const service = new AccessAdministrationService(
    permissions,
    tenants,
    identities,
    groups,
    tenancy,
  );
  const actor = {
    id: 'admin-user',
    entraOid: 'admin-oid',
    email: 'admin@example.com',
    name: 'Admin',
    roles: ['tenant-admin'],
    tenantId: 'tenant-1',
  };

  beforeEach(() => {
    jest.resetAllMocks();
    (tenancy.getTenantId as jest.Mock).mockReturnValue('tenant-1');
  });

  it('fails closed before tenant data is read when the caller is not an admin', async () => {
    (permissions.check as jest.Mock).mockResolvedValue({ allowed: false });

    await expect(service.list('tenant-1', actor, {})).rejects.toThrow(ForbiddenException);
    expect(tenants.listMemberships).not.toHaveBeenCalled();
    expect(identities.findDisplayRecords).not.toHaveBeenCalled();
  });

  it('does not reveal whether another tenant exists when context does not match', async () => {
    (tenancy.getTenantId as jest.Mock).mockReturnValue('tenant-2');

    await expect(service.list('tenant-1', actor, {})).rejects.toThrow(ForbiddenException);
    expect(permissions.check).not.toHaveBeenCalled();
    expect(tenants.listMemberships).not.toHaveBeenCalled();
  });

  it('returns deterministic paged users with direct, group, and effective provenance', async () => {
    (permissions.check as jest.Mock).mockResolvedValue({ allowed: true });
    (tenants.listMemberships as jest.Mock).mockResolvedValue([
      { id: 'm2', tenantId: 'tenant-1', userId: 'user-b', role: 'member', createdAt: new Date() },
      { id: 'm1', tenantId: 'tenant-1', userId: 'user-a', role: 'owner', createdAt: new Date() },
      { id: 'm3', tenantId: 'tenant-1', userId: 'user-c', role: 'member', createdAt: new Date() },
    ]);
    (identities.findDisplayRecords as jest.Mock).mockResolvedValue([
      { id: 'user-a', email: 'a@example.com', name: 'A' },
      { id: 'user-b', email: 'b@example.com', name: 'B' },
    ]);
    (permissions.listResourceTuples as jest.Mock).mockResolvedValue({
      consistencyVersion: 'model-7',
      tuples: [
        {
          subject: 'user:user-b',
          relation: 'admin',
          resource: 'tenant:tenant-1',
          condition: null,
          createdAt: null,
        },
        {
          subject: 'group:engineering#member',
          relation: 'editor',
          resource: 'tenant:tenant-1',
          condition: null,
          createdAt: null,
        },
      ],
    });
    (groups.listMemberships as jest.Mock).mockResolvedValue({
      consistencyVersion: 'groups-3',
      groups: [{ groupId: 'engineering', userIds: ['user-b'] }],
    });

    const result = await service.list('tenant-1', actor, { limit: 1, cursor: 'user-a' });

    expect(result.consistencyVersion).toBe('permissions:model-7;groups:groups-3');
    expect(result.users).toEqual([
      {
        id: 'user-b',
        email: 'b@example.com',
        name: 'B',
        effectiveRoleIds: ['admin', 'editor', 'viewer'],
        effectivePermissionIds: ['create', 'delete', 'manage_access', 'read', 'update'],
        provenance: [
          { source: 'direct', roleId: 'admin' },
          { source: 'group', roleId: 'editor', groupId: 'engineering' },
          { source: 'membership', roleId: 'viewer' },
        ],
      },
    ]);
    expect(result.nextCursor).toBe('user-b');
    expect(identities.findDisplayRecords).toHaveBeenCalledWith(['user-b']);
  });
});
