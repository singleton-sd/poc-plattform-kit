import { HttpStatus } from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
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

  it('does not expose direct grant or revoke handlers over HTTP', () => {
    const controller = new PermissionsController(new PermissionsService());

    expect('grant' in controller).toBe(false);
    expect('revoke' in controller).toBe(false);
  });

  it('reports the permissions pillar health', () => {
    const controller = new PermissionsController(new PermissionsService());

    expect(controller.health()).toEqual({ status: 'ok', pillar: 'permissions' });
  });
});
