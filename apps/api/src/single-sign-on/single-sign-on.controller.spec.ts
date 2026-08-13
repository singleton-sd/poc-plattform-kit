import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { AuthenticatedUser } from '@poc-plattform-kit/pillar-single-sign-on';
import { TenantService } from '@poc-plattform-kit/pillar-tenant';
import { SessionOrJwtAuthGuard } from './jwt-auth.guard';
import { SingleSignOnController } from './single-sign-on.controller';

describe('SingleSignOnController', () => {
  let controller: SingleSignOnController;
  const tenantService = { listMembershipsForUser: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SingleSignOnController],
      providers: [{ provide: TenantService, useValue: tenantService }],
    })
      .overrideGuard(SessionOrJwtAuthGuard)
      .useValue({
        canActivate: (ctx: { switchToHttp: () => { getRequest: () => unknown } }) => {
          const req = ctx.switchToHttp().getRequest() as { user?: AuthenticatedUser };
          if (!req.user) {
            throw new UnauthorizedException();
          }
          return true;
        },
      })
      .compile();

    controller = module.get(SingleSignOnController);
  });

  it('returns Me shape with tenant memberships for authenticated user', async () => {
    const user: AuthenticatedUser = {
      id: '1',
      entraOid: 'oid',
      email: 'agent@example.com',
      name: 'Agent',
      roles: ['support-agent', 'tenant-admin'],
      tenantId: null,
    };
    tenantService.listMembershipsForUser.mockResolvedValue([
      { id: 'm1', tenantId: 'tenant-1', userId: '1', role: 'owner', createdAt: new Date() },
    ]);
    await expect(controller.me(user)).resolves.toEqual({
      id: '1',
      email: 'agent@example.com',
      name: 'Agent',
      roles: ['support-agent', 'tenant-admin'],
      memberships: [{ tenantId: 'tenant-1', role: 'owner' }],
    });
  });

  it('returns an empty memberships array for a user without a tenant', async () => {
    tenantService.listMembershipsForUser.mockResolvedValue([]);
    await expect(
      controller.me({
        id: '1',
        entraOid: 'oid',
        email: 'agent@example.com',
        name: null,
        roles: [],
        tenantId: null,
      }),
    ).resolves.toMatchObject({ memberships: [] });
  });
});
