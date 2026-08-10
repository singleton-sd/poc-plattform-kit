import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PermissionsService } from '@poc-plattform-kit/pillar-permissions';
import type { AuthenticatedUser } from '@poc-plattform-kit/pillar-single-sign-on';
import { matchRoutePermission, PermissionMappingError } from './route-permissions';

interface PermissionRequest {
  method: string;
  route?: { path?: string };
  params?: Record<string, string | undefined>;
  user?: AuthenticatedUser;
}

/**
 * API-host mapping for fine-grained authorization.
 *
 * Route → OpenFGA Check() mappings live in
 * `infra/openfga/permissions.manifest.json` (see docs/permissions.md).
 * Keep authorization rules out of pillar controllers.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly permissions: PermissionsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<PermissionRequest>();
    let permission: { action: string; resource: string } | null;
    try {
      permission = matchRoutePermission(request);
    } catch (error) {
      if (error instanceof PermissionMappingError) {
        throw new ForbiddenException(error.message);
      }
      throw error;
    }
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
}
