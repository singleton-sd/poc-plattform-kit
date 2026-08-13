import { ForbiddenException, Injectable } from '@nestjs/common';
import { PermissionsService } from '@poc-plattform-kit/pillar-permissions';
import { RoleAssignmentCommandService } from '@poc-plattform-kit/pillar-permissions';
import {
  type AuthenticatedUser,
  UserIdentityService,
} from '@poc-plattform-kit/pillar-single-sign-on';
import { TenancyContext, TenantService } from '@poc-plattform-kit/pillar-tenant';
import {
  ACCESS_PERMISSION_CATALOG,
  ACCESS_ROLE_CATALOG,
  type AccessRoleId,
  normalizeMembershipRole,
} from './access-administration.catalog';
import type {
  AccessAdministrationResponseDto,
  AccessAssignmentProvenanceDto,
  TenantAccessUserDto,
} from './dto/access-administration-response.dto';
import type { ListAccessAdministrationQueryDto } from './dto/list-access-administration-query.dto';
import { TenantGroupAccessReader } from './tenant-group-access.reader';

const rolePermissions = new Map(
  ACCESS_ROLE_CATALOG.map((role) => [role.id, [...role.permissionIds]] as const),
);

function isRoleId(value: string): value is AccessRoleId {
  return rolePermissions.has(value as AccessRoleId);
}

function directUserId(subject: string): string | undefined {
  return subject.startsWith('user:') ? subject.slice('user:'.length) || undefined : undefined;
}

function directGroupId(subject: string): string | undefined {
  const match = /^group:([^#]+)#member$/.exec(subject);
  return match?.[1];
}

function sortProvenance(
  provenance: AccessAssignmentProvenanceDto[],
): AccessAssignmentProvenanceDto[] {
  const key = (entry: AccessAssignmentProvenanceDto) =>
    `${entry.source}:${entry.roleId}:${entry.groupId ?? ''}`;
  return provenance.sort((left, right) => key(left).localeCompare(key(right)));
}

@Injectable()
export class AccessAdministrationService {
  constructor(
    private readonly permissions: PermissionsService,
    private readonly roleAssignments: RoleAssignmentCommandService,
    private readonly tenants: TenantService,
    private readonly identities: UserIdentityService,
    private readonly groups: TenantGroupAccessReader,
    private readonly tenancy: TenancyContext,
  ) {}

  async list(
    tenantId: string,
    actor: AuthenticatedUser,
    query: ListAccessAdministrationQueryDto,
  ): Promise<AccessAdministrationResponseDto> {
    const contextTenantId = this.tenancy.getTenantId();
    if (
      (contextTenantId && contextTenantId !== tenantId) ||
      (actor.tenantId && actor.tenantId !== tenantId)
    ) {
      throw new ForbiddenException('Permission denied');
    }

    const admin = await this.permissions.check({
      subject: `user:${actor.id}`,
      action: 'admin',
      resource: `tenant:${tenantId}`,
    });
    if (!admin.allowed) {
      throw new ForbiddenException('Permission denied');
    }

    const memberships = await this.tenants.listMemberships(tenantId);
    const orderedIds = [...new Set(memberships.map((membership) => membership.userId))].sort();
    const afterCursor = query.cursor
      ? orderedIds.filter((userId) => userId.localeCompare(query.cursor!) > 0)
      : orderedIds;
    const limit = Math.min(query.limit ?? 25, 100);
    const pageIds = afterCursor.slice(0, limit);
    const hasMore = afterCursor.length > pageIds.length;

    const [displayRecords, tuplePage, groupProjection, localAssignments, roleVersion] =
      await Promise.all([
        this.identities.findDisplayRecords(pageIds),
        this.permissions.listResourceTuples(`tenant:${tenantId}`),
        this.groups.listMemberships(tenantId),
        this.roleAssignments.listAssignments(tenantId),
        this.roleAssignments.currentVersion(tenantId),
      ]);
    const displayById = new Map(displayRecords.map((record) => [record.id, record]));
    const membershipByUser = new Map(
      memberships.map((membership) => [membership.userId, membership]),
    );
    const groupMembers = new Map(
      groupProjection.groups.map((group) => [group.groupId, new Set(group.userIds)]),
    );

    const users: TenantAccessUserDto[] = [];
    for (const userId of pageIds) {
      const display = displayById.get(userId);
      if (!display) {
        continue;
      }

      const provenance: AccessAssignmentProvenanceDto[] = [];
      const membershipRole = normalizeMembershipRole(membershipByUser.get(userId)?.role ?? '');
      if (membershipRole) {
        provenance.push({ source: 'membership', roleId: membershipRole });
      }

      const tuples = [
        ...tuplePage.tuples,
        ...localAssignments.map((assignment) => ({
          subject:
            assignment.principalType === 'user'
              ? `user:${assignment.principalId}`
              : `group:${assignment.principalId}#member`,
          relation: assignment.roleId,
          resource: `tenant:${tenantId}`,
          condition: null,
          createdAt: assignment.syncedAt?.toISOString() ?? null,
        })),
      ];
      for (const tuple of tuples) {
        if (!isRoleId(tuple.relation)) {
          continue;
        }
        if (directUserId(tuple.subject) === userId) {
          provenance.push({ source: 'direct', roleId: tuple.relation });
          continue;
        }
        const groupId = directGroupId(tuple.subject);
        if (groupId && groupMembers.get(groupId)?.has(userId)) {
          provenance.push({ source: 'group', roleId: tuple.relation, groupId });
        }
      }

      const uniqueProvenance = [
        ...new Map(
          provenance.map((entry) => [
            `${entry.source}:${entry.roleId}:${entry.groupId ?? ''}`,
            entry,
          ]),
        ).values(),
      ];
      const effectiveRoleIds = [...new Set(uniqueProvenance.map((entry) => entry.roleId))].sort();
      const effectivePermissionIds = [
        ...new Set(
          effectiveRoleIds.flatMap((roleId) => rolePermissions.get(roleId as AccessRoleId) ?? []),
        ),
      ].sort();

      users.push({
        ...display,
        effectiveRoleIds,
        effectivePermissionIds,
        provenance: sortProvenance(uniqueProvenance),
      });
    }

    return {
      tenantId,
      consistencyVersion: roleVersion,
      roles: ACCESS_ROLE_CATALOG.map((role) => ({
        ...role,
        permissionIds: [...role.permissionIds],
      })),
      permissions: ACCESS_PERMISSION_CATALOG.map((permission) => ({ ...permission })),
      users,
      nextCursor: hasMore ? pageIds.at(-1)! : null,
    };
  }
}
