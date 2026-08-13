import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { RoleAssignmentService } from './role-assignment.service';

describe('RoleAssignmentService', () => {
  const actor = {
    id: 'admin-1',
    entraOid: 'oid-admin',
    email: 'admin@example.invalid',
    name: 'Admin',
    roles: ['tenant-admin'],
    tenantId: 'tenant-1',
  };
  const commands = {
    execute: jest.fn(),
    listAssignments: jest.fn(),
    replayIfPresent: jest.fn(),
  };
  const permissions = {
    check: jest.fn(),
    checkTenantRole: jest.fn(),
  };
  const tenants = { listMemberships: jest.fn() };
  const groups = { existsForTenant: jest.fn(), listAccessProjection: jest.fn() };
  const tenancy = { getTenantId: jest.fn() };
  const service = new RoleAssignmentService(
    commands as never,
    permissions as never,
    tenants as never,
    groups as never,
    tenancy as never,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    tenancy.getTenantId.mockReturnValue('tenant-1');
    permissions.check.mockResolvedValue({ allowed: true });
    tenants.listMemberships.mockResolvedValue([
      { tenantId: 'tenant-1', userId: 'admin-1', role: 'owner' },
      { tenantId: 'tenant-1', userId: 'user-1', role: 'member' },
    ]);
    commands.execute.mockResolvedValue({
      consistencyVersion: 'roles:1',
      changed: true,
      assigned: true,
    });
    commands.replayIfPresent.mockResolvedValue(undefined);
  });

  it('requires bounded idempotency and concurrency headers', async () => {
    await expect(
      service.execute({
        tenantId: 'tenant-1',
        principalType: 'user',
        principalId: 'user-1',
        roleId: 'editor',
        assigned: true,
        actor,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(permissions.check).not.toHaveBeenCalled();
  });

  it('fails before tenant reads when actor context crosses tenants', async () => {
    await expect(
      service.execute({
        tenantId: 'tenant-2',
        principalType: 'user',
        principalId: 'user-1',
        roleId: 'editor',
        assigned: true,
        actor,
        idempotencyKey: 'command-1234',
        ifMatch: 'roles:0',
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(tenants.listMemberships).not.toHaveBeenCalled();
  });

  it('does not assign roles to a non-member', async () => {
    tenants.listMemberships.mockResolvedValue([]);
    await expect(
      service.execute({
        tenantId: 'tenant-1',
        principalType: 'user',
        principalId: 'unknown',
        roleId: 'viewer',
        assigned: true,
        actor,
        idempotencyKey: 'command-1234',
        ifMatch: 'roles:0',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('delegates a valid direct assignment to the durable command service', async () => {
    await expect(
      service.execute({
        tenantId: 'tenant-1',
        principalType: 'user',
        principalId: 'user-1',
        roleId: 'editor',
        assigned: true,
        actor,
        idempotencyKey: 'command-1234',
        ifMatch: 'roles:0',
      }),
    ).resolves.toEqual({ consistencyVersion: 'roles:1', changed: true, assigned: true });
    expect(commands.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        principalType: 'user',
        principalId: 'user-1',
        roleId: 'editor',
        actorId: 'admin-1',
      }),
    );
  });

  it('returns a matching replay before authorization and principal gates', async () => {
    const replay = { consistencyVersion: 'roles:1', changed: true, assigned: true };
    commands.replayIfPresent.mockResolvedValue(replay);
    permissions.check.mockResolvedValue({ allowed: false });
    tenants.listMemberships.mockResolvedValue([]);

    await expect(
      service.execute({
        tenantId: 'tenant-1',
        principalType: 'user',
        principalId: 'gone',
        roleId: 'editor',
        assigned: true,
        actor,
        idempotencyKey: 'command-1234',
        ifMatch: 'roles:0',
      }),
    ).resolves.toEqual(replay);
    expect(permissions.check).not.toHaveBeenCalled();
    expect(tenants.listMemberships).not.toHaveBeenCalled();
  });

  it('forbids an admin who is not an owner from changing owner access', async () => {
    tenants.listMemberships.mockResolvedValue([
      { tenantId: 'tenant-1', userId: 'user-1', role: 'member' },
    ]);
    permissions.checkTenantRole.mockResolvedValue(false);
    await expect(
      service.execute({
        tenantId: 'tenant-1',
        principalType: 'user',
        principalId: 'user-1',
        roleId: 'owner',
        assigned: true,
        actor,
        idempotencyKey: 'command-1234',
        ifMatch: 'roles:0',
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(commands.execute).not.toHaveBeenCalled();
  });
});
