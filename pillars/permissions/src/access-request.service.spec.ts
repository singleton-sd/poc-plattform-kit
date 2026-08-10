import {
  BadRequestException,
  ConflictException,
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
  const otherTenantManager: AuthenticatedUser = {
    id: 'user-other',
    entraOid: 'oid-mgr',
    email: 'other@example.com',
    name: 'Other',
    roles: [],
    tenantId: 't2',
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
    requestExpiresAt: null as Date | null,
    grantExpiresAt: null as Date | null,
    preferredGrantType: null as string | null,
    preferredGrantExpiresAt: null as Date | null,
    createdAt: now,
    updatedAt: now,
  };

  let prisma: {
    $transaction: jest.Mock;
    accessRequest: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    tenantMembership: { findFirst: jest.Mock };
    permissionsAudit: { create: jest.Mock };
    permissionsOutbox: { create: jest.Mock };
  };
  let permissions: { check: jest.Mock; grant: jest.Mock; revoke: jest.Mock };
  let managerChain: { getManagerChain: jest.Mock };
  let service: AccessRequestService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
    prisma = {
      $transaction: jest.fn(async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)),
      accessRequest: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      tenantMembership: { findFirst: jest.fn() },
      permissionsAudit: { create: jest.fn().mockResolvedValue({}) },
      permissionsOutbox: { create: jest.fn().mockResolvedValue({}) },
    };
    permissions = {
      check: jest.fn().mockResolvedValue({ allowed: false }),
      grant: jest
        .fn()
        .mockResolvedValue({ granted: true, grantType: PermissionGrantType.Permanent }),
      revoke: jest.fn().mockResolvedValue({ revoked: true }),
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
    expect(prisma.accessRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 't1',
          requestExpiresAt: null,
          preferredGrantType: null,
          preferredGrantExpiresAt: null,
        }),
      }),
    );
    expect(prisma.permissionsOutbox.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: 'permission.access_requested' }),
      }),
    );
  });

  it('returns existing non-expired pending request instead of creating a duplicate', async () => {
    prisma.accessRequest.findFirst.mockResolvedValue(pendingRow);

    const result = await service.create({ action: 'update', resource: 'tenant:t1' }, requester);

    expect(result.id).toBe('ar1');
    expect(prisma.accessRequest.create).not.toHaveBeenCalled();
  });

  it('lists the caller access requests filtered by action and resource', async () => {
    prisma.accessRequest.findMany.mockResolvedValue([pendingRow]);

    await expect(
      service.listMine(requester, { action: 'update', resource: 'tenant:t1' }),
    ).resolves.toEqual([pendingRow]);
    expect(prisma.accessRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          requesterId: 'user-req',
          action: 'update',
          resource: 'tenant:t1',
        }),
      }),
    );
  });

  it('rejects create when body tenantId differs and caller is not a member', async () => {
    prisma.tenantMembership.findFirst.mockResolvedValue(null);

    await expect(
      service.create({ action: 'update', resource: 'tenant:t2', tenantId: 't2' }, requester),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.accessRequest.create).not.toHaveBeenCalled();
  });

  it('allows create with body tenantId when membership exists', async () => {
    prisma.tenantMembership.findFirst.mockResolvedValue({ id: 'm1' });
    prisma.accessRequest.create.mockResolvedValue({ ...pendingRow, tenantId: 't2' });

    await expect(
      service.create({ action: 'update', resource: 'tenant:t2', tenantId: 't2' }, requester),
    ).resolves.toMatchObject({ tenantId: 't2' });
    expect(prisma.tenantMembership.findFirst).toHaveBeenCalledWith({
      where: { tenantId: 't2', userId: 'user-req' },
    });
  });

  it('lists pending with SQL non-expired filter and does not mutate expired rows', async () => {
    prisma.accessRequest.findMany.mockResolvedValue([pendingRow]);
    managerChain.getManagerChain.mockResolvedValue(['oid-mgr']);

    await expect(service.listPendingForApprover(manager)).resolves.toEqual([
      expect.objectContaining({ id: 'ar1' }),
    ]);
    expect(prisma.accessRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'pending',
          OR: [{ requestExpiresAt: null }, { requestExpiresAt: { gt: now } }],
        }),
      }),
    );
    expect(prisma.accessRequest.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    [PermissionGrantType.Permanent, undefined],
    [PermissionGrantType.Temporary, '2026-08-11T12:00:00.000Z'],
    [PermissionGrantType.OneTime, undefined],
  ])('approves via Grant API for grant type %s', async (grantType, expiresAt) => {
    prisma.accessRequest.findUnique.mockResolvedValue(pendingRow);
    managerChain.getManagerChain.mockResolvedValue(['oid-mgr']);
    permissions.grant.mockResolvedValue({ granted: true, grantType });
    const approved = {
      ...pendingRow,
      status: 'approved',
      decidedById: manager.id,
      decidedAt: now,
      grantType,
      grantExpiresAt: expiresAt ? new Date(expiresAt) : null,
      requestExpiresAt: new Date('2026-09-01T00:00:00.000Z'),
    };
    prisma.accessRequest.findUniqueOrThrow.mockResolvedValue(approved);

    const result = await service.approve(
      'ar1',
      { grantType, ...(expiresAt ? { expiresAt } : {}) },
      manager,
    );

    expect(result.status).toBe('approved');
    expect(result.requestExpiresAt?.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(result.grantExpiresAt?.toISOString() ?? null).toBe(expiresAt ?? null);
    expect(prisma.accessRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ar1', status: 'pending' },
        data: expect.objectContaining({ status: 'approving' }),
      }),
    );
    expect(permissions.grant).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'user:user-req',
        grantType,
        ...(expiresAt ? { expiresAt } : {}),
      }),
    );
  });

  it('aborts concurrent approve when claim updateMany returns 0', async () => {
    prisma.accessRequest.findUnique.mockResolvedValue(pendingRow);
    managerChain.getManagerChain.mockResolvedValue(['oid-mgr']);
    prisma.accessRequest.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      service.approve('ar1', { grantType: PermissionGrantType.Permanent }, manager),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(permissions.grant).not.toHaveBeenCalled();
  });

  it('revokes OpenFGA grant when post-grant DB finalize fails', async () => {
    prisma.accessRequest.findUnique.mockResolvedValue(pendingRow);
    managerChain.getManagerChain.mockResolvedValue(['oid-mgr']);
    permissions.grant.mockResolvedValue({
      granted: true,
      grantType: PermissionGrantType.Permanent,
    });
    prisma.accessRequest.updateMany
      .mockResolvedValueOnce({ count: 1 }) // claim
      .mockResolvedValueOnce({ count: 0 }); // finalize lost

    await expect(
      service.approve('ar1', { grantType: PermissionGrantType.Permanent }, manager),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(permissions.revoke).toHaveBeenCalledWith({
      subject: 'user:user-req',
      action: 'update',
      resource: 'tenant:t1',
    });
  });

  it('returns permission denied when a non-admin non-manager tries to approve', async () => {
    prisma.accessRequest.findUnique.mockResolvedValue(pendingRow);
    managerChain.getManagerChain.mockResolvedValue(['oid-mgr']);
    permissions.check.mockResolvedValue({ allowed: false });

    await expect(
      service.approve('ar1', { grantType: PermissionGrantType.Permanent }, stranger),
    ).rejects.toMatchObject({
      response: { statusCode: 403, message: 'Not an eligible approver for this access request' },
    });
    expect(permissions.grant).not.toHaveBeenCalled();
  });

  it('rejects cross-tenant manager even when Graph chain matches', async () => {
    prisma.accessRequest.findUnique.mockResolvedValue(pendingRow);
    managerChain.getManagerChain.mockResolvedValue(['oid-mgr']);

    await expect(
      service.approve('ar1', { grantType: PermissionGrantType.Permanent }, otherTenantManager),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(permissions.grant).not.toHaveBeenCalled();
  });

  it('rejects self-approval by a tenant admin', async () => {
    prisma.accessRequest.findUnique.mockResolvedValue(pendingRow);
    permissions.check.mockResolvedValue({ allowed: true });

    await expect(
      service.approve('ar1', { grantType: PermissionGrantType.Permanent }, requester),
    ).rejects.toMatchObject({
      response: { statusCode: 403, message: 'Cannot approve or deny your own access request' },
    });
    expect(permissions.grant).not.toHaveBeenCalled();
  });

  it('returns permission denied when a non-admin non-manager tries to deny', async () => {
    prisma.accessRequest.findUnique.mockResolvedValue(pendingRow);
    managerChain.getManagerChain.mockResolvedValue(['oid-mgr']);
    permissions.check.mockResolvedValue({ allowed: false });

    await expect(service.deny('ar1', { reason: 'nope' }, stranger)).rejects.toMatchObject({
      response: { statusCode: 403, message: 'Not an eligible approver for this access request' },
    });
  });

  it('allows a tenant admin (OpenFGA admin) to approve even when not the manager', async () => {
    prisma.accessRequest.findUnique.mockResolvedValue(pendingRow);
    managerChain.getManagerChain.mockResolvedValue(['oid-mgr']);
    permissions.check.mockResolvedValue({ allowed: true });
    permissions.grant.mockResolvedValue({
      granted: true,
      grantType: PermissionGrantType.Permanent,
    });
    prisma.accessRequest.findUniqueOrThrow.mockResolvedValue({
      ...pendingRow,
      status: 'approved',
      decidedById: stranger.id,
      decidedAt: now,
      grantType: PermissionGrantType.Permanent,
    });

    await expect(
      service.approve('ar1', { grantType: PermissionGrantType.Permanent }, stranger),
    ).resolves.toMatchObject({ status: 'approved', decidedById: stranger.id });
    expect(permissions.grant).toHaveBeenCalled();
  });

  it('denies with optional reason and notifies requester via outbox', async () => {
    prisma.accessRequest.findUnique.mockResolvedValue(pendingRow);
    managerChain.getManagerChain.mockResolvedValue(['oid-mgr']);
    prisma.accessRequest.findUniqueOrThrow.mockResolvedValue({
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

  it('marks expired pending requests on decide and rejects approve', async () => {
    const expired = {
      ...pendingRow,
      requestExpiresAt: new Date('2026-08-10T11:00:00.000Z'),
    };
    prisma.accessRequest.findUnique.mockResolvedValue(expired);
    prisma.accessRequest.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      service.approve('ar1', { grantType: PermissionGrantType.Permanent }, manager),
    ).rejects.toBeInstanceOf(GoneException);
    expect(prisma.accessRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ar1', status: 'pending' },
        data: { status: 'expired' },
      }),
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
