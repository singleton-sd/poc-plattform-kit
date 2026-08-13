import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PermissionsService,
  RoleAssignmentCommandService,
  type RoleAssignmentCommandResult,
  type RolePrincipalType,
} from '@poc-plattform-kit/pillar-permissions';
import type { AuthenticatedUser } from '@poc-plattform-kit/pillar-single-sign-on';
import {
  TenancyContext,
  TenantGroupService,
  TenantService,
} from '@poc-plattform-kit/pillar-tenant';
import { ACCESS_ROLE_CATALOG, type AccessRoleId } from './access-administration.catalog';

const IDEMPOTENCY_KEY = /^[A-Za-z0-9._:-]{8,128}$/;
const VERSION = /^roles:\d+$/;

@Injectable()
export class RoleAssignmentService {
  constructor(
    private readonly commands: RoleAssignmentCommandService,
    private readonly permissions: PermissionsService,
    private readonly tenants: TenantService,
    private readonly groups: TenantGroupService,
    private readonly tenancy: TenancyContext,
  ) {}

  async execute(input: {
    tenantId: string;
    principalType: RolePrincipalType;
    principalId: string;
    roleId: string;
    assigned: boolean;
    actor: AuthenticatedUser;
    idempotencyKey?: string;
    ifMatch?: string;
  }): Promise<RoleAssignmentCommandResult> {
    this.validateHeaders(input.idempotencyKey, input.ifMatch);
    const roleId = this.role(input.roleId);
    const command = {
      tenantId: input.tenantId,
      principalType: input.principalType,
      principalId: input.principalId,
      roleId,
      assigned: input.assigned,
      actorId: input.actor.id,
      idempotencyKey: input.idempotencyKey!,
      ifMatch: input.ifMatch!,
      protectLastOwner: roleId === 'owner',
    };
    const replay = await this.commands.replayIfPresent(command);
    if (replay) return replay;
    this.assertTenant(input.tenantId, input.actor);
    const admin = await this.permissions.check({
      subject: `user:${input.actor.id}`,
      action: 'admin',
      resource: `tenant:${input.tenantId}`,
    });
    if (!admin.allowed) throw new ForbiddenException('Permission denied');

    const memberships = await this.tenants.listMemberships(input.tenantId);
    if (input.principalType === 'user') {
      if (!memberships.some((membership) => membership.userId === input.principalId)) {
        throw new NotFoundException('Access principal not found');
      }
    } else if (!(await this.groups.existsForTenant(input.tenantId, input.principalId))) {
      throw new NotFoundException('Access principal not found');
    }

    if (roleId === 'owner') {
      const actorOwner =
        memberships.some(
          (membership) => membership.userId === input.actor.id && membership.role === 'owner',
        ) ||
        (await this.permissions.checkTenantRole(`user:${input.actor.id}`, 'owner', input.tenantId));
      if (!actorOwner) throw new ForbiddenException('Only an owner may change owner access');
    }
    return this.commands.execute(command);
  }

  private assertTenant(tenantId: string, actor: AuthenticatedUser): void {
    const context = this.tenancy.getTenantId();
    if ((context && context !== tenantId) || (actor.tenantId && actor.tenantId !== tenantId)) {
      throw new ForbiddenException('Permission denied');
    }
  }

  private validateHeaders(idempotencyKey?: string, ifMatch?: string): void {
    if (!idempotencyKey || !IDEMPOTENCY_KEY.test(idempotencyKey)) {
      throw new BadRequestException('Idempotency-Key must be 8-128 safe characters');
    }
    if (!ifMatch || !VERSION.test(ifMatch)) {
      throw new BadRequestException('If-Match must be an opaque role consistency version');
    }
  }

  private role(value: string): AccessRoleId {
    if (!ACCESS_ROLE_CATALOG.some((role) => role.id === value)) {
      throw new BadRequestException('Unknown role');
    }
    return value as AccessRoleId;
  }
}
