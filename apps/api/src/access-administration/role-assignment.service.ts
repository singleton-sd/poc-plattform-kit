import {
  BadRequestException,
  ConflictException,
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
    this.assertTenant(input.tenantId, input.actor);
    const roleId = this.role(input.roleId);
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
      if (!input.assigned) {
        await this.assertOwnerRemains(
          input.tenantId,
          input.principalType,
          input.principalId,
          memberships,
        );
      }
    }

    return this.commands.execute({
      tenantId: input.tenantId,
      principalType: input.principalType,
      principalId: input.principalId,
      roleId,
      assigned: input.assigned,
      actorId: input.actor.id,
      idempotencyKey: input.idempotencyKey!,
      ifMatch: input.ifMatch!,
    });
  }

  private async assertOwnerRemains(
    tenantId: string,
    principalType: RolePrincipalType,
    principalId: string,
    memberships: Array<{ userId: string; role: string }>,
  ): Promise<void> {
    const humans = new Set(
      memberships.filter((membership) => membership.role === 'owner').map((m) => m.userId),
    );
    const [assignments, projection] = await Promise.all([
      this.commands.listAssignments(tenantId),
      this.groups.listAccessProjection(tenantId),
    ]);
    for (const assignment of assignments.filter((item) => item.roleId === 'owner')) {
      if (assignment.principalType === 'user') humans.add(assignment.principalId);
      else {
        projection.groups
          .find((group) => group.groupId === assignment.principalId)
          ?.userIds.forEach((id) => humans.add(id));
      }
    }
    if (principalType === 'user') {
      const hasOtherOwnerSource =
        memberships.some(
          (membership) => membership.userId === principalId && membership.role === 'owner',
        ) ||
        assignments.some(
          (assignment) =>
            assignment.roleId === 'owner' &&
            assignment.principalType === 'group' &&
            projection.groups
              .find((group) => group.groupId === assignment.principalId)
              ?.userIds.includes(principalId),
        );
      if (!hasOtherOwnerSource) humans.delete(principalId);
    } else {
      const removedUsers =
        projection.groups.find((group) => group.groupId === principalId)?.userIds ?? [];
      for (const userId of removedUsers) {
        const hasOtherOwnerSource =
          memberships.some((m) => m.userId === userId && m.role === 'owner') ||
          assignments.some(
            (a) => a.roleId === 'owner' && a.principalType === 'user' && a.principalId === userId,
          ) ||
          assignments.some(
            (a) =>
              a.roleId === 'owner' &&
              a.principalType === 'group' &&
              a.principalId !== principalId &&
              projection.groups
                .find((group) => group.groupId === a.principalId)
                ?.userIds.includes(userId),
          );
        if (!hasOtherOwnerSource) humans.delete(userId);
      }
    }
    if (humans.size === 0) throw new ConflictException('A tenant must retain an owner');
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
