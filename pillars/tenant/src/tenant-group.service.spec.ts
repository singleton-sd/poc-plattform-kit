import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '@poc-plattform-kit/pillar-single-sign-on';
import { TenantGroupService } from './tenant-group.service';

const actor: AuthenticatedUser = {
  id: 'owner-1',
  entraOid: 'entra-owner',
  email: 'owner@example.test',
  name: 'Owner',
  roles: [],
  tenantId: null,
};

describe('TenantGroupService', () => {
  const group = {
    id: 'group-1',
    tenantId: 'tenant-1',
    name: 'Editors',
    description: null,
    createdAt: new Date('2026-08-13T00:00:00Z'),
    updatedAt: new Date('2026-08-13T00:00:00Z'),
  };
  const membership = {
    id: 'group-member-1',
    tenantId: 'tenant-1',
    groupId: 'group-1',
    userId: 'user-1',
    syncStatus: 'pending',
    syncError: null,
    syncedAt: null,
    createdAt: new Date('2026-08-13T00:00:00Z'),
    updatedAt: new Date('2026-08-13T00:00:00Z'),
  };

  type PrismaMock = {
    $transaction: jest.Mock;
    tenant: { findUnique: jest.Mock };
    user: { findUnique: jest.Mock };
    tenantMembership: { findFirst: jest.Mock };
    tenantGroup: {
      create: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      count: jest.Mock;
    };
    tenantGroupMembership: {
      create: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      deleteMany: jest.Mock;
    };
    tenantAudit: { create: jest.Mock };
    tenantOutbox: { create: jest.Mock };
  };

  let prisma: PrismaMock;
  let permissions: {
    addTenantGroupMember: jest.Mock;
    removeTenantGroupMember: jest.Mock;
    isTenantGroupOwner: jest.Mock;
  };
  let service: TenantGroupService;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(async (fn: (tx: PrismaMock) => unknown) => fn(prisma)),
      tenant: { findUnique: jest.fn().mockResolvedValue({ id: 'tenant-1' }) },
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'user-1' }) },
      tenantMembership: {
        findFirst: jest.fn().mockResolvedValue({ role: 'owner' }),
      },
      tenantGroup: {
        create: jest.fn().mockResolvedValue(group),
        findFirst: jest.fn().mockResolvedValue(group),
        findMany: jest.fn().mockResolvedValue([group]),
        update: jest.fn().mockResolvedValue({ ...group, name: 'Writers' }),
        delete: jest.fn().mockResolvedValue(group),
        count: jest.fn().mockResolvedValue(1),
      },
      tenantGroupMembership: {
        create: jest.fn().mockResolvedValue(membership),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([membership]),
        update: jest.fn().mockResolvedValue({
          ...membership,
          syncStatus: 'synced',
          syncedAt: new Date(),
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      tenantAudit: { create: jest.fn().mockResolvedValue({}) },
      tenantOutbox: { create: jest.fn().mockResolvedValue({}) },
    };
    permissions = {
      addTenantGroupMember: jest.fn().mockResolvedValue(true),
      removeTenantGroupMember: jest.fn().mockResolvedValue(true),
      isTenantGroupOwner: jest.fn().mockResolvedValue(false),
    };
    service = new TenantGroupService(prisma as never, permissions as never);
  });

  it('allows only a tenant owner or global tenant-admin to manage groups', async () => {
    prisma.tenantMembership.findFirst.mockResolvedValue(null);

    await expect(service.list('tenant-1', actor)).rejects.toThrow(ForbiddenException);
    await expect(service.list('tenant-1', { ...actor, roles: ['tenant-admin'] })).resolves.toEqual([
      group,
    ]);
  });

  it('projects only synchronized group members for access evaluation', async () => {
    const updatedAt = new Date('2026-08-13T01:00:00Z');
    prisma.tenantGroupMembership.findMany.mockResolvedValue([
      { ...membership, syncStatus: 'synced', updatedAt },
    ]);

    await expect(service.listAccessProjection('tenant-1')).resolves.toEqual({
      consistencyVersion: updatedAt.toISOString(),
      groups: [{ groupId: 'group-1', userIds: ['user-1'] }],
    });
    expect(prisma.tenantGroupMembership.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', syncStatus: 'synced' },
      orderBy: [{ groupId: 'asc' }, { userId: 'asc' }],
    });
  });

  it('creates a tenant-local group with audit and outbox records atomically', async () => {
    await expect(
      service.create('tenant-1', { name: ' Editors ', description: undefined }, actor),
    ).resolves.toEqual(group);

    expect(prisma.tenantGroup.create).toHaveBeenCalledWith({
      data: { tenantId: 'tenant-1', name: 'Editors', description: null },
    });
    expect(prisma.tenantAudit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityType: 'TenantGroup',
        entityId: 'group-1',
        action: 'created',
        actorId: 'owner-1',
      }),
    });
    expect(prisma.tenantOutbox.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventType: 'tenant.group_created' }),
    });
  });

  it('maps duplicate names inside one tenant to Conflict', async () => {
    prisma.$transaction.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }));
    await expect(service.create('tenant-1', { name: 'Editors' }, actor)).rejects.toThrow(
      ConflictException,
    );
  });

  it('rejects a group id belonging to another tenant', async () => {
    prisma.tenantGroup.findFirst.mockResolvedValue(null);
    await expect(
      service.update('tenant-1', 'other-group', { name: 'Writers' }, actor),
    ).rejects.toThrow(NotFoundException);
  });

  it('requires a target user to be a member of the same tenant', async () => {
    prisma.tenantMembership.findFirst
      .mockResolvedValueOnce({ role: 'owner' })
      .mockResolvedValueOnce(null);

    await expect(
      service.addMember('tenant-1', 'group-1', { userId: 'user-1' }, actor),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.tenantGroupMembership.create).not.toHaveBeenCalled();
  });

  it('keeps an addition ineffective until its OpenFGA tuple is synchronized', async () => {
    prisma.tenantMembership.findFirst
      .mockResolvedValueOnce({ role: 'owner' })
      .mockResolvedValueOnce({ role: 'member' });

    const result = await service.addMember('tenant-1', 'group-1', { userId: 'user-1' }, actor);

    expect(prisma.tenantGroupMembership.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ syncStatus: 'pending' }),
    });
    expect(permissions.addTenantGroupMember).toHaveBeenCalledWith('group-1', 'user-1');
    expect(prisma.tenantGroupMembership.updateMany).toHaveBeenCalledWith({
      where: { id: 'group-member-1', syncStatus: { in: ['pending', 'failed'] } },
      data: { syncStatus: 'synced', syncError: null, syncedAt: expect.any(Date) },
    });
    expect(result.syncStatus).toBe('synced');
  });

  it('records a failed addition and returns 503 instead of granting locally', async () => {
    prisma.tenantMembership.findFirst
      .mockResolvedValueOnce({ role: 'owner' })
      .mockResolvedValueOnce({ role: 'member' });
    permissions.addTenantGroupMember.mockResolvedValue(false);

    await expect(
      service.addMember('tenant-1', 'group-1', { userId: 'user-1' }, actor),
    ).rejects.toThrow(ServiceUnavailableException);
    expect(prisma.tenantGroupMembership.updateMany).toHaveBeenCalledWith({
      where: { id: 'group-member-1', syncStatus: { in: ['pending', 'failed'] } },
      data: { syncStatus: 'failed', syncError: 'OpenFGA membership write failed' },
    });
  });

  it('removes the OpenFGA tuple before deleting local membership', async () => {
    prisma.tenantGroupMembership.findFirst.mockResolvedValue({
      ...membership,
      syncStatus: 'synced',
    });

    await service.removeMember('tenant-1', 'group-1', 'user-1', actor);

    expect(permissions.removeTenantGroupMember).toHaveBeenCalledWith('group-1', 'user-1');
    expect(prisma.tenantGroupMembership.updateMany).toHaveBeenCalledWith({
      where: { id: 'group-member-1', syncStatus: 'synced' },
      data: { syncStatus: 'pending', syncError: null, syncedAt: null },
    });
    expect(prisma.tenantGroupMembership.deleteMany).toHaveBeenCalledWith({
      where: { id: 'group-member-1', tenantId: 'tenant-1', groupId: 'group-1' },
    });
    expect(prisma.tenantAudit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'member_removed' }),
    });
  });

  it('leaves local membership intact when OpenFGA revocation fails', async () => {
    prisma.tenantGroupMembership.findFirst.mockResolvedValue({
      ...membership,
      syncStatus: 'synced',
    });
    permissions.removeTenantGroupMember.mockResolvedValue(false);

    await expect(service.removeMember('tenant-1', 'group-1', 'user-1', actor)).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(prisma.tenantGroupMembership.deleteMany).not.toHaveBeenCalled();
  });

  it('refuses membership removal while the group principal holds owner', async () => {
    prisma.tenantGroupMembership.findFirst.mockResolvedValue(membership);
    permissions.isTenantGroupOwner.mockResolvedValue(true);

    await expect(service.removeMember('tenant-1', 'group-1', 'user-1', actor)).rejects.toThrow(
      ConflictException,
    );
    expect(permissions.removeTenantGroupMember).not.toHaveBeenCalled();
  });

  it('deletes a group only after every effective member tuple is revoked', async () => {
    prisma.tenantGroupMembership.findMany.mockResolvedValue([
      { ...membership, syncStatus: 'synced' },
    ]);
    await service.remove('tenant-1', 'group-1', actor);

    expect(permissions.removeTenantGroupMember).toHaveBeenCalledWith('group-1', 'user-1');
    expect(prisma.tenantGroupMembership.deleteMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', groupId: 'group-1' },
    });
    expect(prisma.tenantGroup.delete).toHaveBeenCalledWith({ where: { id: 'group-1' } });
  });

  it('refuses group deletion while the group principal holds owner', async () => {
    permissions.isTenantGroupOwner.mockResolvedValue(true);

    await expect(service.remove('tenant-1', 'group-1', actor)).rejects.toThrow(ConflictException);
    expect(prisma.tenantGroup.delete).not.toHaveBeenCalled();
  });

  it('reconciles pending and failed additions and leaves failures fail-closed', async () => {
    prisma.tenantGroupMembership.findMany.mockResolvedValue([
      membership,
      { ...membership, id: 'group-member-2', userId: 'user-2', syncStatus: 'failed' },
    ]);
    permissions.addTenantGroupMember.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    await expect(service.reconcilePending(10)).resolves.toEqual({ attempted: 2, synced: 1 });
    expect(prisma.tenantGroupMembership.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'group-member-2', syncStatus: { in: ['pending', 'failed'] } },
        data: { syncStatus: 'failed', syncError: 'OpenFGA membership write failed' },
      }),
    );
  });
});
