import type { AuthenticatedUser } from '@poc-plattform-kit/pillar-single-sign-on';
import { ROLES_KEY } from './roles.decorator';
import { TenantController } from './tenant.controller';

const user: AuthenticatedUser = {
  entraOid: 'entra-1',
  email: 'user@example.test',
  name: 'User',
  roles: [],
  id: 'user-1',
  tenantId: null,
};

describe('TenantController', () => {
  it('restricts tenant listing to support agents', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, TenantController.prototype.findAll) as string[];

    expect(roles).toEqual(['support-agent']);
  });

  it('passes validated list filters to the service', async () => {
    const page = { items: [], nextCursor: null };
    const tenants = { findAll: jest.fn().mockResolvedValue(page) };
    const controller = new TenantController(tenants as never);

    await expect(controller.findAll({ q: 'acme', limit: 5 })).resolves.toEqual(page);
    expect(tenants.findAll).toHaveBeenCalledWith({ q: 'acme', limit: 5 });
  });

  it('allows support agents and tenant admins to create tenants', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, TenantController.prototype.create) as string[];

    expect(roles).toEqual(['support-agent', 'tenant-admin']);
  });

  it('creates a tenant with the authenticated caller as the acting user', async () => {
    const tenant = { id: 't1', name: 'Acme', slug: 'acme', settings: null };
    const tenants = { create: jest.fn().mockResolvedValue(tenant) };
    const controller = new TenantController(tenants as never);
    const user: AuthenticatedUser = {
      entraOid: 'entra-1',
      email: 'admin@example.test',
      name: 'Admin',
      roles: ['tenant-admin'],
      id: 'user-1',
      tenantId: null,
    };

    await expect(controller.create({ name: 'Acme' }, user)).resolves.toEqual(tenant);
    expect(tenants.create).toHaveBeenCalledWith({ name: 'Acme' }, 'user-1');
  });

  describe('createSelfService', () => {
    afterEach(() => {
      delete process.env.SELF_SERVICE_TENANT_LIMIT;
    });

    it('has no @Roles gate -- any authenticated user may call it', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, TenantController.prototype.createSelfService) as
        string[] | undefined;

      expect(roles).toBeUndefined();
    });

    it('delegates to TenantService.create with the default self-service cap', async () => {
      const tenant = { id: 't1', name: 'Acme', slug: 'acme', settings: null };
      const tenants = { create: jest.fn().mockResolvedValue(tenant) };
      const controller = new TenantController(tenants as never);

      await expect(controller.createSelfService({ name: 'Acme' }, user)).resolves.toEqual(tenant);
      expect(tenants.create).toHaveBeenCalledWith({ name: 'Acme' }, 'user-1', {
        maxOwnedTenants: 1,
      });
    });

    it('passes a configured SELF_SERVICE_TENANT_LIMIT into create', async () => {
      process.env.SELF_SERVICE_TENANT_LIMIT = '3';
      const tenant = { id: 't3', name: 'Third Co', slug: 'third-co', settings: null };
      const tenants = { create: jest.fn().mockResolvedValue(tenant) };
      const controller = new TenantController(tenants as never);

      await expect(controller.createSelfService({ name: 'Third Co' }, user)).resolves.toEqual(
        tenant,
      );
      expect(tenants.create).toHaveBeenCalledWith({ name: 'Third Co' }, 'user-1', {
        maxOwnedTenants: 3,
      });
    });
  });

  it('does not role-gate PATCH -- ownership is enforced in the service', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, TenantController.prototype.update) as
      string[] | undefined;

    expect(roles).toBeUndefined();
  });

  it('passes the authenticated caller through to TenantService.update', async () => {
    const tenant = { id: 't1', name: 'Acme', slug: 'acme', settings: null };
    const tenants = { update: jest.fn().mockResolvedValue(tenant) };
    const controller = new TenantController(tenants as never);

    await expect(controller.update('t1', { name: 'Acme' }, user)).resolves.toEqual(tenant);
    expect(tenants.update).toHaveBeenCalledWith('t1', { name: 'Acme' }, user);
  });
});
