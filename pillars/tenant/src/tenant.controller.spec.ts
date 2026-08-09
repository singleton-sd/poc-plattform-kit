import { ConflictException } from '@nestjs/common';
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

    it('delegates to the same TenantService.create used by the admin route when under quota', async () => {
      const tenant = { id: 't1', name: 'Acme', slug: 'acme', settings: null };
      const tenants = {
        create: jest.fn().mockResolvedValue(tenant),
        countOwnedTenants: jest.fn().mockResolvedValue(0),
      };
      const controller = new TenantController(tenants as never);

      await expect(controller.createSelfService({ name: 'Acme' }, user)).resolves.toEqual(tenant);
      expect(tenants.countOwnedTenants).toHaveBeenCalledWith('user-1');
      expect(tenants.create).toHaveBeenCalledWith({ name: 'Acme' }, 'user-1');
    });

    it('allows a caller who owns zero tenants to create their first one', async () => {
      const tenant = { id: 't1', name: 'Acme', slug: 'acme', settings: null };
      const tenants = {
        create: jest.fn().mockResolvedValue(tenant),
        countOwnedTenants: jest.fn().mockResolvedValue(0),
      };
      const controller = new TenantController(tenants as never);

      await expect(controller.createSelfService({ name: 'Acme' }, user)).resolves.toEqual(tenant);
    });

    it('rejects with 409 once the caller is at the default cap of 1', async () => {
      const tenants = {
        create: jest.fn(),
        countOwnedTenants: jest.fn().mockResolvedValue(1),
      };
      const controller = new TenantController(tenants as never);

      await expect(controller.createSelfService({ name: 'Second Co' }, user)).rejects.toThrow(
        ConflictException,
      );
      expect(tenants.create).not.toHaveBeenCalled();
    });

    it('respects a configured SELF_SERVICE_TENANT_LIMIT', async () => {
      process.env.SELF_SERVICE_TENANT_LIMIT = '3';
      const tenant = { id: 't3', name: 'Third Co', slug: 'third-co', settings: null };
      const tenants = {
        create: jest.fn().mockResolvedValue(tenant),
        countOwnedTenants: jest.fn().mockResolvedValue(2),
      };
      const controller = new TenantController(tenants as never);

      await expect(controller.createSelfService({ name: 'Third Co' }, user)).resolves.toEqual(
        tenant,
      );

      const tenantsAtCap = {
        create: jest.fn(),
        countOwnedTenants: jest.fn().mockResolvedValue(3),
      };
      const controllerAtCap = new TenantController(tenantsAtCap as never);

      await expect(controllerAtCap.createSelfService({ name: 'Fourth Co' }, user)).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
