import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PermissionsService } from '@poc-plattform-kit/pillar-permissions';
import type { AuthenticatedUser } from '@poc-plattform-kit/pillar-single-sign-on';

interface PermissionRequest {
  method: string;
  route?: { path?: string };
  params?: { id?: string };
  user?: AuthenticatedUser;
}

/**
 * API-host mapping for fine-grained authorization.
 *
 * The first protected pattern maps `PATCH /tenants/:id` to:
 * `user:<local user id>`, `update`, `tenant:<route id>`.
 * Add mappings here rather than embedding authorization rules in pillars.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly permissions: PermissionsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<PermissionRequest>();
    const permission = this.mapPermission(request);
    if (!permission) {
      return true;
    }

    // Preserve the existing role + tenancy checks until an OpenFGA endpoint
    // and store are configured; once configured, decisions fail closed.
    if (!this.permissions.isConfigured()) {
      return true;
    }

    if (!request.user?.id) {
      throw new UnauthorizedException('Authenticated identity required for authorization');
    }

    const result = await this.permissions.check({
      subject: `user:${request.user.id}`,
      action: permission.action,
      resource: permission.resource,
    });
    if (!result.allowed) {
      throw new ForbiddenException('Permission denied');
    }
    return true;
  }

  private mapPermission(request: PermissionRequest): { action: string; resource: string } | null {
    if (
      request.method.toUpperCase() === 'PATCH' &&
      request.route?.path === '/tenants/:id' &&
      request.params?.id
    ) {
      return {
        action: 'update',
        resource: `tenant:${request.params.id}`,
      };
    }
    return null;
  }
}
