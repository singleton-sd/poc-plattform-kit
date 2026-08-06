import { PermissionsController } from './permissions.controller';
import { PermissionsService } from './permissions.service';

describe('PermissionsController', () => {
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

  it('reports the permissions pillar health', () => {
    const controller = new PermissionsController(new PermissionsService());

    expect(controller.health()).toEqual({ status: 'ok', pillar: 'permissions' });
  });
});
