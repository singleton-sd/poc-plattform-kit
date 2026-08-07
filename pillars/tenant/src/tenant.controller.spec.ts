import { ROLES_KEY } from './roles.decorator';
import { TenantController } from './tenant.controller';

describe('TenantController', () => {
  it('restricts tenant listing to support agents', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, TenantController.prototype.findAll) as string[];

    expect(roles).toEqual(['support-agent']);
  });

  it('passes validated list filters to the service', async () => {
    const tenants = { findAll: jest.fn().mockResolvedValue([]) };
    const controller = new TenantController(tenants as never);

    await expect(controller.findAll({ q: 'acme', limit: 5 })).resolves.toEqual([]);
    expect(tenants.findAll).toHaveBeenCalledWith({ q: 'acme', limit: 5 });
  });
});
