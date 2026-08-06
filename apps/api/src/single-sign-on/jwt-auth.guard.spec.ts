import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard, SessionOrJwtAuthGuard } from './jwt-auth.guard';
import { IS_PUBLIC_KEY } from './public.decorator';

describe('SessionOrJwtAuthGuard', () => {
  const jwtGuard = {
    canActivate: jest.fn(),
  } as unknown as JwtAuthGuard;

  const reflector = {
    getAllAndOverride: jest.fn(),
  };

  const guard = new SessionOrJwtAuthGuard(jwtGuard, reflector as unknown as Reflector);

  function contextFor(req: Record<string, unknown>): ExecutionContext {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    } as ExecutionContext;
  }

  beforeEach(() => {
    jest.resetAllMocks();
    reflector.getAllAndOverride.mockReturnValue(undefined);
  });

  it('allows requests with authUser from Auth.js session', async () => {
    const req: { authUser?: unknown; user?: unknown; headers: object } = {
      authUser: { id: '1', email: 'a@b.com' },
      headers: {},
    };
    await expect(guard.canActivate(contextFor(req))).resolves.toBe(true);
    expect(req.user).toEqual(req.authUser);
  });

  it('delegates to JwtAuthGuard for Bearer tokens', async () => {
    (jwtGuard.canActivate as jest.Mock).mockResolvedValue(true);
    const req = { headers: { authorization: 'Bearer token' } };
    await expect(guard.canActivate(contextFor(req))).resolves.toBe(true);
    expect(jwtGuard.canActivate).toHaveBeenCalled();
  });

  it('rejects unauthenticated requests', async () => {
    await expect(guard.canActivate(contextFor({ headers: {} }))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('allows @Public() routes without credentials', async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) =>
      key === IS_PUBLIC_KEY ? true : undefined,
    );
    await expect(guard.canActivate(contextFor({ headers: {} }))).resolves.toBe(true);
    expect(jwtGuard.canActivate).not.toHaveBeenCalled();
  });

  it('allows public path allowlist without credentials', async () => {
    await expect(
      guard.canActivate(contextFor({ headers: {}, originalUrl: '/health' })),
    ).resolves.toBe(true);
  });
});
