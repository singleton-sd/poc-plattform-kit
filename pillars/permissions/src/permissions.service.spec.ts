import { PermissionsService } from './permissions.service';

describe('PermissionsService', () => {
  it('fails closed while the OpenFGA adapter is not configured', async () => {
    const service = new PermissionsService();

    await expect(
      service.check({
        subject: 'user:alice',
        action: 'viewer',
        resource: 'document:quarterly-report',
      }),
    ).resolves.toEqual({ allowed: false });
  });
});
