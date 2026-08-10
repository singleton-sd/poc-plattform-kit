import { HttpStatus } from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import type { AuthenticatedUser } from '@poc-plattform-kit/pillar-single-sign-on';
import { AccessRequestController } from './access-request.controller';
import { AccessRequestService } from './access-request.service';
import { PermissionGrantType } from './dto/grant-permission.dto';

describe('AccessRequestController', () => {
  const user: AuthenticatedUser = {
    id: 'user-1',
    entraOid: 'oid-1',
    email: 'u@example.com',
    name: 'User',
    roles: [],
    tenantId: 't1',
  };

  const record = {
    id: 'ar1',
    tenantId: 't1',
    requesterId: 'user-1',
    requesterEntraOid: 'oid-1',
    action: 'update',
    resource: 'tenant:t1',
    status: 'pending' as const,
    decidedById: null,
    decidedAt: null,
    denyReason: null,
    grantType: null,
    expiresAt: null,
    createdAt: new Date('2026-08-10T12:00:00.000Z'),
    updatedAt: new Date('2026-08-10T12:00:00.000Z'),
  };

  it('uses 201 for create and 200 for approve/deny', () => {
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, AccessRequestController.prototype.create)).toBe(
      HttpStatus.CREATED,
    );
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, AccessRequestController.prototype.approve)).toBe(
      HttpStatus.OK,
    );
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, AccessRequestController.prototype.deny)).toBe(
      HttpStatus.OK,
    );
  });

  it('delegates create / list / approve / deny to the service', async () => {
    const accessRequests = {
      create: jest.fn().mockResolvedValue(record),
      listPendingForApprover: jest.fn().mockResolvedValue([record]),
      approve: jest.fn().mockResolvedValue({ ...record, status: 'approved' }),
      deny: jest.fn().mockResolvedValue({ ...record, status: 'denied' }),
    } as unknown as AccessRequestService;
    const controller = new AccessRequestController(accessRequests);

    await expect(
      controller.create({ action: 'update', resource: 'tenant:t1' }, user),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'ar1',
        status: 'pending',
        createdAt: record.createdAt.toISOString(),
      }),
    );
    await expect(controller.listPending(user)).resolves.toEqual({
      items: [expect.objectContaining({ id: 'ar1' })],
    });
    await expect(
      controller.approve('ar1', { grantType: PermissionGrantType.Permanent }, user),
    ).resolves.toEqual(expect.objectContaining({ status: 'approved' }));
    await expect(controller.deny('ar1', { reason: 'no' }, user)).resolves.toEqual(
      expect.objectContaining({ status: 'denied' }),
    );

    expect(accessRequests.create).toHaveBeenCalled();
    expect(accessRequests.listPendingForApprover).toHaveBeenCalledWith(user);
    expect(accessRequests.approve).toHaveBeenCalled();
    expect(accessRequests.deny).toHaveBeenCalled();
  });
});
