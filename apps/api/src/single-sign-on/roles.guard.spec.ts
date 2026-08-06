import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  };
  const guard = new RolesGuard(reflector as unknown as Reflector);

  function contextFor(user?: { role: string | null }): ExecutionContext {
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
    expect(guard.canActivate(contextFor({ role: null }))).toBe(true);
  });

  it('allows when user role is in the required list', () => {
    reflector.getAllAndOverride.mockImplementation((key: string) =>
      key === ROLES_KEY ? ['tenant-admin', 'support-agent'] : undefined,
    );
    expect(guard.canActivate(contextFor({ role: 'support-agent' }))).toBe(true);
  });

  it('rejects when user role is missing or not allowed', () => {
    reflector.getAllAndOverride.mockReturnValue(['tenant-admin']);
    expect(() => guard.canActivate(contextFor({ role: 'support-agent' }))).toThrow(
      ForbiddenException,
    );
    expect(() => guard.canActivate(contextFor())).toThrow(ForbiddenException);
  });
});
