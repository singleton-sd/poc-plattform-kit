import { HttpStatus } from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { PermissionGrantType } from './dto/grant-permission.dto';
import { PermissionsController } from './permissions.controller';
import { PermissionsService } from './permissions.service';

describe('PermissionsController', () => {
  it('returns the documented 200 status for authorization checks', () => {
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, PermissionsController.prototype.check)).toBe(
      HttpStatus.OK,
    );
  });

  it('delegates authorization checks to the permissions service', async () => {
    const permissions = {
      check: jest.fn().mockResolvedValue({ allowed: false }),
    } as unknown as PermissionsService;
    const controller = new PermissionsController(permissions);
    const request = {
      subject: 'user:alice',
      action: 'viewer',
      resource: 'document:quarterly-report',
    };

    await expect(controller.check(request)).resolves.toEqual({ allowed: false });
    expect(permissions.check).toHaveBeenCalledWith(request);
  });

  it('delegates grants and revokes to the permissions service', async () => {
    const permissions = {
      grant: jest
        .fn()
        .mockResolvedValue({ granted: true, grantType: PermissionGrantType.Permanent }),
      revoke: jest.fn().mockResolvedValue({ revoked: true }),
    } as unknown as PermissionsService;
    const controller = new PermissionsController(permissions);
    const grantRequest = {
      subject: 'user:alice',
      action: 'update',
      resource: 'tenant:one',
      grantType: PermissionGrantType.Permanent,
    };
    const revokeRequest = {
      subject: 'user:alice',
      action: 'update',
      resource: 'tenant:one',
    };

    await expect(controller.grant(grantRequest)).resolves.toEqual({
      granted: true,
      grantType: PermissionGrantType.Permanent,
    });
    await expect(controller.revoke(revokeRequest)).resolves.toEqual({ revoked: true });
    expect(permissions.grant).toHaveBeenCalledWith(grantRequest);
    expect(permissions.revoke).toHaveBeenCalledWith(revokeRequest);
  });

  it('reports the permissions pillar health', () => {
    const controller = new PermissionsController(new PermissionsService());

    expect(controller.health()).toEqual({ status: 'ok', pillar: 'permissions' });
  });
});
