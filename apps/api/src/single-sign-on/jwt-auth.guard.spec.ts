import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard, SessionOrJwtAuthGuard } from './jwt-auth.guard';
import { IS_PUBLIC_KEY } from './public.decorator';
import type { UserIdentityService } from '@poc-plattform-kit/pillar-single-sign-on';

describe('SessionOrJwtAuthGuard', () => {
  const jwtGuard = {
    canActivate: jest.fn(),
  } as unknown as JwtAuthGuard;

  const reflector = {
    getAllAndOverride: jest.fn(),
  };
  const identities = {
    persist: jest.fn(),
  };

  const guard = new SessionOrJwtAuthGuard(
    jwtGuard,
    reflector as unknown as Reflector,
    identities as unknown as UserIdentityService,
  );

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
    identities.persist.mockImplementation(async (user: unknown) => user);
  });

  it('allows requests with authUser from Auth.js session', async () => {
    const authUser = {
      id: 'oid-1',
      entraOid: 'oid-1',
      email: 'a@b.com',
      name: null,
      roles: [] as string[],
      tenantId: null,
    };
    const req: { authUser?: typeof authUser; user?: unknown; headers: object } = {
      authUser,
      headers: {},
    };
    identities.persist.mockResolvedValue({ ...req.authUser, id: 'local-1' });
    await expect(guard.canActivate(contextFor(req))).resolves.toBe(true);
    expect(req.user).toEqual({ ...req.authUser, id: 'local-1' });
    expect(identities.persist).toHaveBeenCalledWith(req.authUser);
  });

  it('delegates to JwtAuthGuard for Bearer tokens', async () => {
    (jwtGuard.canActivate as jest.Mock).mockResolvedValue(true);
    const req: { headers: { authorization: string }; user?: unknown } = {
      headers: { authorization: 'Bearer token' },
    };
    (jwtGuard.canActivate as jest.Mock).mockImplementation(async (context) => {
      context.switchToHttp().getRequest().user = {
        id: 'oid-1',
        entraOid: 'oid-1',
        email: 'a@b.com',
      };
      return true;
    });
    identities.persist.mockResolvedValue({
      id: 'local-1',
      entraOid: 'oid-1',
      email: 'a@b.com',
    });
    await expect(guard.canActivate(contextFor(req))).resolves.toBe(true);
    expect(jwtGuard.canActivate).toHaveBeenCalled();
    expect(req.user).toMatchObject({ id: 'local-1' });
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
