import { PATH_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { AccessAdministrationController } from './access-administration.controller';
import { AccessAdministrationService } from './access-administration.service';

describe('AccessAdministrationController', () => {
  it('uses the tenant-scoped access administration route', () => {
    expect(Reflect.getMetadata(PATH_METADATA, AccessAdministrationController)).toBe(
      'tenants/:tenantId/access-administration',
    );
  });

  it('delegates the authenticated actor and typed pagination query', async () => {
    const result = {
      tenantId: 'tenant-1',
      consistencyVersion: 'permissions:model-1;groups:not-available',
      roles: [],
      permissions: [],
      users: [],
      nextCursor: null,
    };
    const list = jest.fn<
      ReturnType<AccessAdministrationService['list']>,
      Parameters<AccessAdministrationService['list']>
    >();
    list.mockResolvedValue(result);
    const module = await Test.createTestingModule({
      controllers: [AccessAdministrationController],
      providers: [{ provide: AccessAdministrationService, useValue: { list } }],
    }).compile();
    const controller = module.get(AccessAdministrationController);
    const actor = {
      id: 'admin-1',
      entraOid: 'oid-1',
      email: 'admin@example.com',
      name: null,
      roles: ['tenant-admin'],
      tenantId: 'tenant-1',
    };

    await expect(controller.list('tenant-1', actor, { limit: 10 })).resolves.toBe(result);
    expect(list).toHaveBeenCalledWith('tenant-1', actor, { limit: 10 });
  });
});
