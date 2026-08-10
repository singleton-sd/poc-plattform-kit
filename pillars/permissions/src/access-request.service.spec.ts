import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '@poc-plattform-kit/pillar-single-sign-on';
import { AccessRequestService } from './access-request.service';
import { PermissionGrantType } from './dto/grant-permission.dto';
import { ManagerChainService } from './manager-chain.service';
import { PermissionsService } from './permissions.service';

describe('AccessRequestService', () => {
  const now = new Date('2026-08-10T12:00:00.000Z');
  const requester: AuthenticatedUser = {
    id: 'user-req',
    entraOid: 'oid-req',
    email: 'req@example.com',
    name: 'Requester',
    roles: [],
    tenantId: 't1',
  };
  const manager: AuthenticatedUser = {
    id: 'user-mgr',
    entraOid: 'oid-mgr',
    email: 'mgr@example.com',
    name: 'Manager',
    roles: [],
    tenantId: 't1',
  };
  const stranger: AuthenticatedUser = {
    id: 'user-x',
    entraOid: 'oid-x',
    email: 'x@example.com',
    name: 'Stranger',
    roles: [],
    tenantId: 't1',
  };

  const pendingRow = {
    id: 'ar1',
    tenantId: 't1',
    requesterId: 'user-req',
    requesterEntraOid: 'oid-req',
    action: 'update',
    resource: 'tenant:t1',
    status: 'pending',
    decidedById: null as string | null,
    decidedAt: null as Date | null,
    denyReason: null as string | null,
    grantType: null as string | null,
    expiresAt: null as Date | null,
    createdAt: now,
    updatedAt: now,
  };

  let prisma: {
    $transaction: jest.Mock;
    accessRequest: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    permissionsAudit: { create: jest.Mock };
    permissionsOutbox: { create: jest.Mock };
  };
  let permissions: { check: jest.Mock; grant: jest.Mock };
  let managerChain: { getManagerChain: jest.Mock };
  let service: AccessRequestService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
    prisma = {
      $transaction: jest.fn(async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)),
      accessRequest: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      permissionsAudit: { create: jest.fn().mockResolvedValue({}) },
      permissionsOutbox: { create: jest.fn().mockResolvedValue({}) },
    };
    permissions = {
      check: jest.fn().mockResolvedValue({ allowed: false }),
      grant: jest
        .fn()
        .mockResolvedValue({ granted: true, grantType: PermissionGrantType.Permanent }),
    };
    managerChain = {
      getManagerChain: jest.fn().mockResolvedValue(['oid-mgr']),
    };
    service = new AccessRequestService(
      prisma as never,
      permissions as unknown as PermissionsService,
      managerChain as unknown as ManagerChainService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates a pending request with audit + access_requested outbox for notifications', async () => {
    prisma.accessRequest.create.mockResolvedValue(pendingRow);

    const created = await service.create({ action: 'update', resource: 'tenant:t1' }, requester);

    expect(created.status).toBe('pending');
    expect(prisma.permissionsAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'created', entityType: 'AccessRequest' }),
      }),
    );
    expect(prisma.permissionsOutbox.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: 'permission.access_requested' }),
      }),
    );
    const outboxPayload = JSON.parse(
      (prisma.permissionsOutbox.create.mock.calls[0][0] as { data: { payload: string } }).data
        .payload,
    ) as { payload: { managerEntraOids: string[] } };
    expect(outboxPayload.payload.managerEntraOids).toEqual(['oid-mgr']);
  });

  it('lists pending requests for a manager and skips unauthorized ones', async () => {
    prisma.accessRequest.findMany.mockResolvedValue([pendingRow]);
    managerChain.getManagerChain.mockResolvedValue(['oid-mgr']);

    await expect(service.listPendingForApprover(manager)).resolves.toEqual([
      expect.objectContaining({ id: 'ar1' }),
    ]);
    await expect(service.listPendingForApprover(stranger)).resolves.toEqual([]);
  });

  it.each([
    [PermissionGrantType.Permanent, undefined],
    [PermissionGrantType.Temporary, '2026-08-11T12:00:00.000Z'],
    [PermissionGrantType.OneTime, undefined],
  ])('approves via Grant API for grant type %s', async (grantType, expiresAt) => {
    prisma.accessRequest.findUnique.mockResolvedValue(pendingRow);
    managerChain.getManagerChain.mockResolvedValue(['oid-mgr']);
    permissions.grant.mockResolvedValue({ granted: true, grantType });
    prisma.accessRequest.update.mockResolvedValue({
      ...pendingRow,
      status: 'approved',
      decidedById: manager.id,
      decidedAt: now,
      grantType,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    });

    const result = await service.approve(
      'ar1',
      { grantType, ...(expiresAt ? { expiresAt } : {}) },
      manager,
    );

    expect(result.status).toBe('approved');
    expect(permissions.grant).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'user:user-req',
        action: 'update',
        resource: 'tenant:t1',
        grantType,
        ...(expiresAt ? { expiresAt } : {}),
      }),
    );
    const outboxTypes = prisma.permissionsOutbox.create.mock.calls.map(
      (call) => (call[0] as { data: { eventType: string } }).data.eventType,
    );
    expect(outboxTypes).toEqual(
      expect.arrayContaining(['permission.access_approved', 'permission.granted']),
    );
  });

  it('rejects unauthorized approve attempts', async () => {
    prisma.accessRequest.findUnique.mockResolvedValue(pendingRow);
    managerChain.getManagerChain.mockResolvedValue(['oid-mgr']);
    permissions.check.mockResolvedValue({ allowed: false });

    await expect(
      service.approve('ar1', { grantType: PermissionGrantType.Permanent }, stranger),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(permissions.grant).not.toHaveBeenCalled();
  });

  it('denies with optional reason and notifies requester via outbox', async () => {
    prisma.accessRequest.findUnique.mockResolvedValue(pendingRow);
    managerChain.getManagerChain.mockResolvedValue(['oid-mgr']);
    prisma.accessRequest.update.mockResolvedValue({
      ...pendingRow,
      status: 'denied',
      decidedById: manager.id,
      decidedAt: now,
      denyReason: 'Nope',
    });

    const result = await service.deny('ar1', { reason: 'Nope' }, manager);

    expect(result.status).toBe('denied');
    expect(prisma.permissionsOutbox.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: 'permission.access_denied' }),
      }),
    );
  });

  it('marks expired pending requests and rejects approve', async () => {
    const expired = {
      ...pendingRow,
      expiresAt: new Date('2026-08-10T11:00:00.000Z'),
    };
    prisma.accessRequest.findUnique.mockResolvedValue(expired);
    prisma.accessRequest.update.mockResolvedValue({ ...expired, status: 'expired' });

    await expect(
      service.approve('ar1', { grantType: PermissionGrantType.Permanent }, manager),
    ).rejects.toBeInstanceOf(GoneException);
    expect(prisma.accessRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'expired' } }),
    );
    expect(permissions.grant).not.toHaveBeenCalled();
  });

  it('returns 404 when the request is missing', async () => {
    prisma.accessRequest.findUnique.mockResolvedValue(null);
    await expect(
      service.approve('missing', { grantType: PermissionGrantType.Permanent }, manager),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('requires tenantId when creating without a session tenant', async () => {
    await expect(
      service.create({ action: 'update', resource: 'tenant:t1' }, { ...requester, tenantId: null }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
