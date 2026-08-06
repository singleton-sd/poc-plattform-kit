import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard, SessionOrJwtAuthGuard } from './jwt-auth.guard';

describe('SessionOrJwtAuthGuard', () => {
  const jwtGuard = {
    canActivate: jest.fn(),
  } as unknown as JwtAuthGuard;

  const guard = new SessionOrJwtAuthGuard(jwtGuard);

  function contextFor(req: Record<string, unknown>): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    } as ExecutionContext;
  }

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('allows requests with authUser from Auth.js session', async () => {
    const req: { authUser?: unknown; user?: unknown } = {
      authUser: { id: '1', email: 'a@b.com' },
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
});
