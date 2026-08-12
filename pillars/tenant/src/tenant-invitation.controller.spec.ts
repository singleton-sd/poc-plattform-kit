import type { AuthenticatedUser } from '@poc-plattform-kit/pillar-single-sign-on';
import { TenantInvitationController } from './tenant-invitation.controller';

const actor: AuthenticatedUser = {
  entraOid: 'entra-1',
  email: 'admin@example.test',
  name: 'Admin',
  roles: ['tenant-admin'],
  id: 'user-1',
  tenantId: null,
};

describe('TenantInvitationController', () => {
  it('creates an invitation for the tenant in the route, scoped by tenantId', async () => {
    const invitation = {
      id: 'inv-1',
      tenantId: 't1',
      email: 'invitee@example.test',
      role: 'member',
    };
    const invitations = { create: jest.fn().mockResolvedValue(invitation) };
    const controller = new TenantInvitationController(invitations as never);

    await expect(
      controller.create('t1', { email: 'invitee@example.test', role: 'member' }, actor),
    ).resolves.toEqual(invitation);
    expect(invitations.create).toHaveBeenCalledWith(
      't1',
      { email: 'invitee@example.test', role: 'member' },
      actor,
    );
  });

  it('lists invitations for the tenant in the route', async () => {
    const page = [{ id: 'inv-1' }];
    const invitations = { findAllForTenant: jest.fn().mockResolvedValue(page) };
    const controller = new TenantInvitationController(invitations as never);

    await expect(controller.findAll('t1', actor)).resolves.toEqual(page);
    expect(invitations.findAllForTenant).toHaveBeenCalledWith('t1', actor);
  });

  it('revokes an invitation scoped by tenantId and invitationId', async () => {
    const invitations = { revoke: jest.fn().mockResolvedValue(undefined) };
    const controller = new TenantInvitationController(invitations as never);

    await controller.revoke('t1', 'inv-1', actor);
    expect(invitations.revoke).toHaveBeenCalledWith('t1', 'inv-1', actor);
  });
});
