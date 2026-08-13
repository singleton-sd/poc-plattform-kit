import type { AuthenticatedUser } from '@poc-plattform-kit/pillar-single-sign-on';
import { TenantGroupController } from './tenant-group.controller';

const actor: AuthenticatedUser = {
  id: 'owner-1',
  entraOid: 'entra-owner',
  email: 'owner@example.test',
  name: 'Owner',
  roles: [],
  tenantId: null,
};

describe('TenantGroupController', () => {
  it('forwards tenant-scoped group lifecycle operations', async () => {
    const groups = {
      list: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 'group-1' }),
      update: jest.fn().mockResolvedValue({ id: 'group-1', name: 'Writers' }),
      remove: jest.fn().mockResolvedValue(undefined),
      listMembers: jest.fn().mockResolvedValue([]),
      addMember: jest.fn().mockResolvedValue({ id: 'membership-1' }),
      removeMember: jest.fn().mockResolvedValue(undefined),
    };
    const controller = new TenantGroupController(groups as never);

    await controller.list('tenant-1', actor);
    await controller.create('tenant-1', { name: 'Editors' }, actor);
    await controller.update('tenant-1', 'group-1', { name: 'Writers' }, actor);
    await controller.listMembers('tenant-1', 'group-1', actor);
    await controller.addMember('tenant-1', 'group-1', { userId: 'user-1' }, actor);
    await controller.removeMember('tenant-1', 'group-1', 'user-1', actor);
    await controller.remove('tenant-1', 'group-1', actor);

    expect(groups.list).toHaveBeenCalledWith('tenant-1', actor);
    expect(groups.create).toHaveBeenCalledWith('tenant-1', { name: 'Editors' }, actor);
    expect(groups.update).toHaveBeenCalledWith('tenant-1', 'group-1', { name: 'Writers' }, actor);
    expect(groups.addMember).toHaveBeenCalledWith(
      'tenant-1',
      'group-1',
      { userId: 'user-1' },
      actor,
    );
    expect(groups.removeMember).toHaveBeenCalledWith('tenant-1', 'group-1', 'user-1', actor);
    expect(groups.remove).toHaveBeenCalledWith('tenant-1', 'group-1', actor);
  });
});
