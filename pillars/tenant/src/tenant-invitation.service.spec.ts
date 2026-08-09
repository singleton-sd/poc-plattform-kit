import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '@poc-plattform-kit/pillar-single-sign-on';
import { TenantInvitationService } from './tenant-invitation.service';

function user(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    entraOid: 'entra-1',
    email: 'actor@example.test',
    name: 'Actor',
    roles: [],
    id: 'user-1',
    tenantId: null,
    ...overrides,
  };
}

describe('TenantInvitationService', () => {
  const invitationRow = {
    id: 'inv-1',
    tenantId: 't1',
    email: 'invitee@example.test',
    role: 'member',
    invitedByUserId: 'user-1',
    token: 'raw-token-value',
    status: 'pending',
    expiresAt: new Date('2026-01-08T00:00:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    respondedAt: null as Date | null,
  };

  let prisma: {
    $transaction: jest.Mock;
    tenantInvitation: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    tenantMembership: { findFirst: jest.Mock };
    tenantAudit: { create: jest.Mock };
    tenantOutbox: { create: jest.Mock };
  };
  let service: TenantInvitationService;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(),
      tenantInvitation: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      tenantMembership: { findFirst: jest.fn() },
      tenantAudit: { create: jest.fn() },
      tenantOutbox: { create: jest.fn() },
    };
    service = new TenantInvitationService(prisma as never);
  });

  describe('guard', () => {
    it('allows a global tenant-admin without checking membership', async () => {
      prisma.tenantInvitation.findMany.mockResolvedValue([]);

      await service.findAllForTenant('t1', user({ roles: ['tenant-admin'] }));

      expect(prisma.tenantMembership.findFirst).not.toHaveBeenCalled();
    });

    it('allows a global support-agent without checking membership', async () => {
      prisma.tenantInvitation.findMany.mockResolvedValue([]);

      await service.findAllForTenant('t1', user({ roles: ['support-agent'] }));

      expect(prisma.tenantMembership.findFirst).not.toHaveBeenCalled();
    });

    it('allows a caller with an owner TenantMembership on the target tenant', async () => {
      prisma.tenantMembership.findFirst.mockResolvedValue({
        id: 'm1',
        tenantId: 't1',
        userId: 'user-1',
        role: 'owner',
      });
      prisma.tenantInvitation.findMany.mockResolvedValue([]);

      await service.findAllForTenant('t1', user({ roles: [] }));

      expect(prisma.tenantMembership.findFirst).toHaveBeenCalledWith({
        where: { tenantId: 't1', userId: 'user-1', role: 'owner' },
      });
    });

    it('rejects a caller with no matching role and no owner membership', async () => {
      prisma.tenantMembership.findFirst.mockResolvedValue(null);

      await expect(service.findAllForTenant('t1', user({ roles: ['member'] }))).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.tenantInvitation.findMany).not.toHaveBeenCalled();
    });

    it('rejects a caller whose owner membership is on a different tenant', async () => {
      prisma.tenantMembership.findFirst.mockResolvedValue(null);

      await expect(service.findAllForTenant('t1', user())).rejects.toThrow(ForbiddenException);
      expect(prisma.tenantMembership.findFirst).toHaveBeenCalledWith({
        where: { tenantId: 't1', userId: 'user-1', role: 'owner' },
      });
    });
  });

  describe('create', () => {
    beforeEach(() => {
      prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) =>
        fn(prisma),
      );
      prisma.tenantAudit.create.mockResolvedValue({});
      prisma.tenantOutbox.create.mockResolvedValue({});
      prisma.tenantInvitation.create.mockResolvedValue(invitationRow);
    });

    it('creates a pending invitation, strips the token from the returned record', async () => {
      prisma.tenantInvitation.findFirst.mockResolvedValue(null);

      const result = await service.create(
        't1',
        { email: 'Invitee@Example.test', role: 'member' },
        user({ roles: ['tenant-admin'] }),
      );

      expect(result).toEqual({
        id: 'inv-1',
        tenantId: 't1',
        email: 'invitee@example.test',
        role: 'member',
        invitedByUserId: 'user-1',
        status: 'pending',
        expiresAt: invitationRow.expiresAt,
        createdAt: invitationRow.createdAt,
        respondedAt: null,
      });
      expect(result).not.toHaveProperty('token');
      expect(prisma.tenantInvitation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 't1',
          email: 'invitee@example.test',
          role: 'member',
          invitedByUserId: 'user-1',
          status: 'pending',
        }),
      });
    });

    it('sets expiresAt roughly 7 days out', async () => {
      prisma.tenantInvitation.findFirst.mockResolvedValue(null);
      const before = Date.now();

      await service.create(
        't1',
        { email: 'invitee@example.test', role: 'member' },
        user({ roles: ['tenant-admin'] }),
      );

      const call = prisma.tenantInvitation.create.mock.calls[0][0];
      const expiresAt = (call.data.expiresAt as Date).getTime();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      expect(expiresAt).toBeGreaterThanOrEqual(before + sevenDaysMs - 5000);
      expect(expiresAt).toBeLessThanOrEqual(Date.now() + sevenDaysMs + 5000);
    });

    it('writes a TenantAudit entry in the same transaction', async () => {
      prisma.tenantInvitation.findFirst.mockResolvedValue(null);

      await service.create(
        't1',
        { email: 'invitee@example.test', role: 'member' },
        user({ roles: ['tenant-admin'] }),
      );

      expect(prisma.tenantAudit.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entityType: 'TenantInvitation',
            entityId: 'inv-1',
            action: 'created',
            actorId: 'user-1',
          }),
        }),
      );
    });

    it('emits a tenant.invitation_created outbox event with the raw token', async () => {
      prisma.tenantInvitation.findFirst.mockResolvedValue(null);

      await service.create(
        't1',
        { email: 'invitee@example.test', role: 'member' },
        user({ roles: ['tenant-admin'] }),
      );

      expect(prisma.tenantOutbox.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventType: 'tenant.invitation_created' }),
        }),
      );
      const call = prisma.tenantOutbox.create.mock.calls[0][0];
      const payload = JSON.parse(call.data.payload);
      expect(payload).toMatchObject({
        type: 'tenant.invitation_created',
        tenantId: 't1',
        payload: {
          invitationId: 'inv-1',
          tenantId: 't1',
          email: 'invitee@example.test',
          role: 'member',
        },
      });
      expect(typeof payload.payload.token).toBe('string');
      expect(payload.payload.token.length).toBeGreaterThan(0);
    });

    it('rejects a duplicate pending invitation for the same tenant + email', async () => {
      prisma.tenantInvitation.findFirst.mockResolvedValue(invitationRow);

      await expect(
        service.create(
          't1',
          { email: 'invitee@example.test', role: 'member' },
          user({ roles: ['tenant-admin'] }),
        ),
      ).rejects.toThrow(ConflictException);
      expect(prisma.tenantInvitation.create).not.toHaveBeenCalled();
    });

    it('rejects the caller when the coarse guard fails', async () => {
      prisma.tenantMembership.findFirst.mockResolvedValue(null);

      await expect(
        service.create(
          't1',
          { email: 'invitee@example.test', role: 'member' },
          user({ roles: [] }),
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.tenantInvitation.findFirst).not.toHaveBeenCalled();
      expect(prisma.tenantInvitation.create).not.toHaveBeenCalled();
    });
  });

  describe('findAllForTenant', () => {
    it('lists invitations for a tenant ordered by creation time, without tokens', async () => {
      prisma.tenantInvitation.findMany.mockResolvedValue([invitationRow]);

      const result = await service.findAllForTenant('t1', user({ roles: ['support-agent'] }));

      expect(result).toEqual([
        {
          id: 'inv-1',
          tenantId: 't1',
          email: 'invitee@example.test',
          role: 'member',
          invitedByUserId: 'user-1',
          status: 'pending',
          expiresAt: invitationRow.expiresAt,
          createdAt: invitationRow.createdAt,
          respondedAt: null,
        },
      ]);
      expect(result[0]).not.toHaveProperty('token');
      expect(prisma.tenantInvitation.findMany).toHaveBeenCalledWith({
        where: { tenantId: 't1' },
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  describe('revoke', () => {
    it('marks a pending invitation revoked and writes an audit entry', async () => {
      prisma.tenantInvitation.findFirst.mockResolvedValue(invitationRow);
      prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) =>
        fn(prisma),
      );
      prisma.tenantInvitation.update.mockResolvedValue({ ...invitationRow, status: 'revoked' });
      prisma.tenantAudit.create.mockResolvedValue({});

      await service.revoke('t1', 'inv-1', user({ roles: ['tenant-admin'] }));

      expect(prisma.tenantInvitation.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: expect.objectContaining({ status: 'revoked' }),
      });
      expect(prisma.tenantAudit.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entityType: 'TenantInvitation',
            entityId: 'inv-1',
            action: 'revoked',
            actorId: 'user-1',
          }),
        }),
      );
    });

    it('throws NotFound when the invitation does not exist for this tenant', async () => {
      prisma.tenantInvitation.findFirst.mockResolvedValue(null);

      await expect(
        service.revoke('t1', 'missing', user({ roles: ['tenant-admin'] })),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws Conflict when the invitation is no longer pending', async () => {
      prisma.tenantInvitation.findFirst.mockResolvedValue({ ...invitationRow, status: 'accepted' });

      await expect(
        service.revoke('t1', 'inv-1', user({ roles: ['tenant-admin'] })),
      ).rejects.toThrow(ConflictException);
      expect(prisma.tenantInvitation.update).not.toHaveBeenCalled();
    });

    it('rejects the caller when the coarse guard fails', async () => {
      prisma.tenantMembership.findFirst.mockResolvedValue(null);

      await expect(service.revoke('t1', 'inv-1', user({ roles: [] }))).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.tenantInvitation.findFirst).not.toHaveBeenCalled();
    });
  });
});
