import { ConflictException } from '@nestjs/common';
import { RoleAssignmentCommandService } from './role-assignment-command.service';

describe('RoleAssignmentCommandService', () => {
  const command = {
    tenantId: 'tenant-1',
    principalType: 'user' as const,
    principalId: 'user-1',
    roleId: 'editor',
    assigned: true,
    actorId: 'admin-1',
    idempotencyKey: 'command-1234',
    ifMatch: 'roles:0',
  };

  it('rejects reuse of an idempotency key for another command before If-Match', async () => {
    const prisma = {
      permissionsRoleCommand: {
        findUnique: jest.fn().mockResolvedValue({
          commandHash: 'another-command',
          assignmentId: 'assignment-1',
          consistencyVersion: 'roles:9',
          changed: true,
          assigned: false,
        }),
      },
    };
    const service = new RoleAssignmentCommandService(prisma as never, {} as never);

    await expect(service.execute({ ...command, ifMatch: 'roles:stale' })).rejects.toThrow(
      ConflictException,
    );
  });

  it('returns an exact no-op replay without evaluating stale If-Match', async () => {
    const crypto = await import('node:crypto');
    const hash = crypto
      .createHash('sha256')
      .update('tenant-1|user|user-1|editor|assign')
      .digest('hex');
    const prisma = {
      permissionsRoleCommand: {
        findUnique: jest.fn().mockResolvedValue({
          commandHash: hash,
          assignmentId: 'assignment-1',
          consistencyVersion: 'roles:1',
          changed: false,
          assigned: true,
        }),
      },
    };
    const service = new RoleAssignmentCommandService(prisma as never, {} as never);

    await expect(service.execute({ ...command, ifMatch: 'roles:stale' })).resolves.toEqual({
      consistencyVersion: 'roles:1',
      changed: false,
      assigned: true,
    });
  });

  it('returns 412 before writing when If-Match is stale', async () => {
    const tx = {
      permissionsRoleCommand: { findUnique: jest.fn().mockResolvedValue(null) },
      permissionsRoleRevision: {
        upsert: jest.fn().mockResolvedValue({ tenantId: 'tenant-1', revision: 2 }),
      },
    };
    const prisma = {
      permissionsRoleCommand: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((callback: (value: typeof tx) => unknown) => callback(tx)),
    };
    const service = new RoleAssignmentCommandService(prisma as never, {} as never);

    await expect(service.execute(command)).rejects.toMatchObject({ status: 412 });
  });

  it('reconciles failed assignments without making them effective early', async () => {
    const update = jest.fn().mockResolvedValue({});
    const prisma = {
      permissionsRoleAssignment: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'assignment-1',
            tenantId: 'tenant-1',
            principalType: 'group',
            principalId: 'group-1',
            roleId: 'viewer',
            assigned: true,
          },
        ]),
        update,
      },
    };
    const permissions = { setTenantRole: jest.fn().mockResolvedValue(true) };
    const service = new RoleAssignmentCommandService(prisma as never, permissions as never);

    await expect(service.reconcilePending()).resolves.toEqual({ attempted: 1, synced: 1 });
    expect(permissions.setTenantRole).toHaveBeenCalledWith(
      'group:group-1#member',
      'viewer',
      'tenant-1',
      true,
    );
    expect(update).toHaveBeenCalledWith({
      where: { id: 'assignment-1' },
      data: { syncStatus: 'synced', syncError: null, syncedAt: expect.any(Date) },
    });
  });
});
