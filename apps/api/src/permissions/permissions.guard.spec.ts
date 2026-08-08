import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedUser } from '@poc-plattform-kit/pillar-single-sign-on';
import type { PermissionsService } from '@poc-plattform-kit/pillar-permissions';
import { PermissionsGuard } from './permissions.guard';

describe('PermissionsGuard', () => {
  const permissions = {
    check: jest.fn(),
  } as unknown as PermissionsService;
  const guard = new PermissionsGuard(permissions);

  function contextFor(options: {
    method?: string;
    path?: string;
    id?: string;
    user?: AuthenticatedUser;
  }): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          method: options.method ?? 'PATCH',
          route: { path: options.path ?? '/tenants/:id' },
          params: { id: options.id ?? 'tenant-1' },
          user: options.user,
        }),
      }),
    } as ExecutionContext;
  }

  const user: AuthenticatedUser = {
    entraOid: 'entra-1',
    email: 'admin@example.test',
    name: 'Admin',
    role: 'tenant-admin',
    id: 'user-1',
    tenantId: 'tenant-1',
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('allows routes without a fine-grained permission mapping', async () => {
    await expect(guard.canActivate(contextFor({ method: 'GET', path: '/health' }))).resolves.toBe(
      true,
    );
    expect(permissions.check).not.toHaveBeenCalled();
  });

  it('maps a tenant update to subject, action, and resource', async () => {
    (permissions.check as jest.Mock).mockResolvedValue({ allowed: true });

    await expect(guard.canActivate(contextFor({ user }))).resolves.toBe(true);
    expect(permissions.check).toHaveBeenCalledWith({
      subject: 'user:user-1',
      action: 'tenant:update',
      resource: 'tenant:tenant-1',
    });
  });

  it('fails closed when the protected route has no identity', async () => {
    await expect(guard.canActivate(contextFor({}))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(permissions.check).not.toHaveBeenCalled();
  });

  it('returns forbidden when Permissions denies the tuple', async () => {
    (permissions.check as jest.Mock).mockResolvedValue({ allowed: false });

    await expect(guard.canActivate(contextFor({ user }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
