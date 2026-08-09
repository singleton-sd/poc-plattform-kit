import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  };
  const guard = new RolesGuard(reflector as unknown as Reflector);

  function contextFor(user?: { roles: string[] }): ExecutionContext {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as ExecutionContext;
  }

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('allows when no roles metadata is set', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(contextFor({ roles: [] }))).toBe(true);
  });

  it('allows when any user role is in the required list', () => {
    reflector.getAllAndOverride.mockImplementation((key: string) =>
      key === ROLES_KEY ? ['tenant-admin'] : undefined,
    );
    expect(guard.canActivate(contextFor({ roles: ['support-agent', 'tenant-admin'] }))).toBe(true);
  });

  it('rejects when user roles are missing or not allowed', () => {
    reflector.getAllAndOverride.mockReturnValue(['tenant-admin']);
    expect(() => guard.canActivate(contextFor({ roles: ['support-agent'] }))).toThrow(
      /Insufficient role; requires one of: tenant-admin/,
    );
    expect(() => guard.canActivate(contextFor())).toThrow(
      /Insufficient role; requires one of: tenant-admin/,
    );
  });
});
