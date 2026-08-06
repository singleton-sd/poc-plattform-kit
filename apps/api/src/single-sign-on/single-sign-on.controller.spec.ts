import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { AuthenticatedUser } from '@poc-plattform-kit/pillar-single-sign-on';
import { SessionOrJwtAuthGuard } from './jwt-auth.guard';
import { SingleSignOnController } from './single-sign-on.controller';

describe('SingleSignOnController', () => {
  let controller: SingleSignOnController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SingleSignOnController],
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

  it('returns Me shape for authenticated user', () => {
    const user: AuthenticatedUser = {
      id: '1',
      entraOid: 'oid',
      email: 'agent@example.com',
      name: 'Agent',
      role: 'support-agent',
      tenantId: null,
    };
    expect(controller.me(user)).toEqual({
      id: '1',
      email: 'agent@example.com',
      name: 'Agent',
      role: 'support-agent',
    });
  });
});
