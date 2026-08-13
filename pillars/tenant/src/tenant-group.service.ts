import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  OnApplicationBootstrap,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@poc-plattform-kit/db';
import type { DomainEvent, DomainEventType } from '@poc-plattform-kit/events';
import type { AuthenticatedUser } from '@poc-plattform-kit/pillar-single-sign-on';
import { AddTenantGroupMemberDto } from './dto/add-tenant-group-member.dto';
import { CreateTenantGroupDto } from './dto/create-tenant-group.dto';
import { UpdateTenantGroupDto } from './dto/update-tenant-group.dto';

const GROUP_MANAGER_ROLES = ['tenant-admin'];
const OPENFGA_SYNC_ERROR = 'OpenFGA membership write failed';
const RECONCILIATION_INTERVAL_MS = 60_000;
const TENANT_GROUP_PERMISSIONS = 'TENANT_GROUP_PERMISSIONS';

export interface TenantGroupPermissionsPort {
  addTenantGroupMember(groupId: string, userId: string): Promise<boolean>;
  removeTenantGroupMember(groupId: string, userId: string): Promise<boolean>;
  isTenantGroupOwner(tenantId: string, groupId: string): Promise<boolean>;
}

export type TenantGroupRecord = {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type TenantGroupMembershipRecord = {
  id: string;
  tenantId: string;
  groupId: string;
  userId: string;
  syncStatus: string;
  syncError: string | null;
  syncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type TenantGroupAccessProjection = {
  consistencyVersion: string;
  groups: Array<{ groupId: string; userIds: string[] }>;
};

function isUniqueConflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'P2002'
  );
}

@Injectable()
export class TenantGroupService implements OnApplicationBootstrap, OnModuleDestroy {
  private reconciliationTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(TENANT_GROUP_PERMISSIONS)
    private readonly permissions: TenantGroupPermissionsPort,
  ) {}

  onApplicationBootstrap(): void {
    this.reconciliationTimer = setInterval(() => {
      void this.reconcilePending().catch(() => {
        // Keep rows pending/failed and retry later. Authorization remains
        // fail-closed because only successfully synchronized tuples apply.
      });
    }, RECONCILIATION_INTERVAL_MS);
    this.reconciliationTimer.unref();
  }

  onModuleDestroy(): void {
    if (this.reconciliationTimer) clearInterval(this.reconciliationTimer);
  }

  /** Narrow internal projection; unsynchronized memberships are never effective. */
  async listAccessProjection(tenantId: string): Promise<TenantGroupAccessProjection> {
    const memberships = await this.prisma.tenantGroupMembership.findMany({
      where: { tenantId, syncStatus: 'synced' },
      orderBy: [{ groupId: 'asc' }, { userId: 'asc' }],
    });
    const grouped = new Map<string, string[]>();
    let consistencyVersion: string | undefined;
    for (const membership of memberships) {
      grouped.set(membership.groupId, [
        ...(grouped.get(membership.groupId) ?? []),
        membership.userId,
      ]);
      const stamp = membership.updatedAt.toISOString();
      if (!consistencyVersion || stamp > consistencyVersion) consistencyVersion = stamp;
    }
    return {
      consistencyVersion: consistencyVersion ?? 'empty',
      groups: [...grouped].map(([groupId, userIds]) => ({ groupId, userIds })),
    };
  }

  async existsForTenant(tenantId: string, groupId: string): Promise<boolean> {
    return (await this.prisma.tenantGroup.count({ where: { id: groupId, tenantId } })) === 1;
  }

  async list(tenantId: string, actor: AuthenticatedUser): Promise<TenantGroupRecord[]> {
    await this.assertCanManage(tenantId, actor);
    return this.prisma.tenantGroup.findMany({
      where: { tenantId },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }

  async create(
    tenantId: string,
    dto: CreateTenantGroupDto,
    actor: AuthenticatedUser,
  ): Promise<TenantGroupRecord> {
    await this.assertCanManage(tenantId, actor);
    const name = dto.name.trim();
    const description = dto.description?.trim() || null;

    try {
      return await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const created = await tx.tenantGroup.create({
          data: { tenantId, name, description },
        });
        await this.writeMutation(tx, {
          tenantId,
          entityId: created.id,
          action: 'created',
          eventType: 'tenant.group_created',
          actorId: actor.id,
          payload: { groupId: created.id, name: created.name },
        });
        return created;
      });
    } catch (error: unknown) {
      if (isUniqueConflict(error)) {
        throw new ConflictException('A group with this name already exists in the tenant');
      }
      throw error;
    }
  }

  async update(
    tenantId: string,
    groupId: string,
    dto: UpdateTenantGroupDto,
    actor: AuthenticatedUser,
  ): Promise<TenantGroupRecord> {
    await this.assertCanManage(tenantId, actor);
    await this.requireGroup(tenantId, groupId);
    const data = {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}),
    };
    try {
      return await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const updated = await tx.tenantGroup.update({ where: { id: groupId }, data });
        await this.writeMutation(tx, {
          tenantId,
          entityId: groupId,
          action: 'updated',
          eventType: 'tenant.group_updated',
          actorId: actor.id,
          payload: { groupId, ...data },
        });
        return updated;
      });
    } catch (error: unknown) {
      if (isUniqueConflict(error)) {
        throw new ConflictException('A group with this name already exists in the tenant');
      }
      throw error;
    }
  }

  async listMembers(
    tenantId: string,
    groupId: string,
    actor: AuthenticatedUser,
  ): Promise<TenantGroupMembershipRecord[]> {
    await this.assertCanManage(tenantId, actor);
    await this.requireGroup(tenantId, groupId);
    return this.prisma.tenantGroupMembership.findMany({
      where: { tenantId, groupId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  async addMember(
    tenantId: string,
    groupId: string,
    dto: AddTenantGroupMemberDto,
    actor: AuthenticatedUser,
  ): Promise<TenantGroupMembershipRecord> {
    await this.assertCanManage(tenantId, actor);
    await this.requireGroup(tenantId, groupId);
    const tenantMember = await this.prisma.tenantMembership.findFirst({
      where: { tenantId, userId: dto.userId },
    });
    if (!tenantMember) {
      throw new NotFoundException('User is not a member of this tenant');
    }

    let membership = await this.prisma.tenantGroupMembership.findFirst({
      where: { tenantId, groupId, userId: dto.userId },
    });
    if (!membership) {
      try {
        membership = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          const created = await tx.tenantGroupMembership.create({
            data: { tenantId, groupId, userId: dto.userId, syncStatus: 'pending' },
          });
          await this.writeMutation(tx, {
            tenantId,
            entityId: created.id,
            action: 'member_added',
            eventType: 'tenant.group_member_added',
            actorId: actor.id,
            payload: { groupId, userId: dto.userId, syncStatus: 'pending' },
          });
          return created;
        });
      } catch (error: unknown) {
        if (!isUniqueConflict(error)) throw error;
        membership = await this.prisma.tenantGroupMembership.findFirst({
          where: { tenantId, groupId, userId: dto.userId },
        });
        if (!membership) throw error;
      }
    }

    if (membership.syncStatus === 'synced') {
      return membership;
    }
    return this.synchronizeAddition(membership);
  }

  async removeMember(
    tenantId: string,
    groupId: string,
    userId: string,
    actor: AuthenticatedUser,
  ): Promise<void> {
    await this.assertCanManage(tenantId, actor);
    await this.requireGroup(tenantId, groupId);
    const membership = await this.prisma.tenantGroupMembership.findFirst({
      where: { tenantId, groupId, userId },
    });
    if (!membership) throw new NotFoundException('Group membership not found');

    if (await this.permissions.isTenantGroupOwner(tenantId, groupId)) {
      throw new ConflictException('Revoke the group owner role before removing group memberships');
    }

    if (membership.syncStatus === 'synced') {
      const revoked = await this.permissions.removeTenantGroupMember(groupId, userId);
      if (!revoked) {
        throw new ServiceUnavailableException('Authorization membership could not be revoked');
      }
      // If the following local delete fails, reconciliation restores the
      // tuple from this still-present source-of-truth row.
      await this.prisma.tenantGroupMembership.updateMany({
        where: { id: membership.id, syncStatus: 'synced' },
        data: { syncStatus: 'pending', syncError: null, syncedAt: null },
      });
    }

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const deleted = await tx.tenantGroupMembership.deleteMany({
        where: { id: membership.id, tenantId, groupId },
      });
      if (deleted.count !== 1) throw new ConflictException('Group membership changed concurrently');
      await this.writeMutation(tx, {
        tenantId,
        entityId: membership.id,
        action: 'member_removed',
        eventType: 'tenant.group_member_removed',
        actorId: actor.id,
        payload: { groupId, userId },
      });
    });
  }

  async remove(tenantId: string, groupId: string, actor: AuthenticatedUser): Promise<void> {
    await this.assertCanManage(tenantId, actor);
    await this.requireGroup(tenantId, groupId);
    if (await this.permissions.isTenantGroupOwner(tenantId, groupId)) {
      throw new ConflictException('Revoke the group owner role before deleting the group');
    }
    const memberships = await this.prisma.tenantGroupMembership.findMany({
      where: { tenantId, groupId },
      orderBy: { id: 'asc' },
    });
    for (const membership of memberships) {
      if (membership.syncStatus === 'synced') {
        if (!(await this.permissions.removeTenantGroupMember(groupId, membership.userId))) {
          throw new ServiceUnavailableException('Authorization memberships could not be revoked');
        }
        await this.prisma.tenantGroupMembership.updateMany({
          where: { id: membership.id, syncStatus: 'synced' },
          data: { syncStatus: 'pending', syncError: null, syncedAt: null },
        });
      }
    }

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.tenantGroupMembership.deleteMany({ where: { tenantId, groupId } });
      await tx.tenantGroup.delete({ where: { id: groupId } });
      await this.writeMutation(tx, {
        tenantId,
        entityId: groupId,
        action: 'deleted',
        eventType: 'tenant.group_deleted',
        actorId: actor.id,
        payload: { groupId },
      });
    });
  }

  async reconcilePending(limit = 100): Promise<{ attempted: number; synced: number }> {
    const pending = await this.prisma.tenantGroupMembership.findMany({
      where: { syncStatus: { in: ['pending', 'failed'] } },
      orderBy: { updatedAt: 'asc' },
      take: Math.min(Math.max(limit, 1), 500),
    });
    let synced = 0;
    for (const membership of pending) {
      const ok = await this.permissions.addTenantGroupMember(membership.groupId, membership.userId);
      if (ok) synced += 1;
      await this.recordSyncResult(membership.id, ok);
    }
    return { attempted: pending.length, synced };
  }

  private async synchronizeAddition(
    membership: TenantGroupMembershipRecord,
  ): Promise<TenantGroupMembershipRecord> {
    const ok = await this.permissions.addTenantGroupMember(membership.groupId, membership.userId);
    await this.recordSyncResult(membership.id, ok);
    if (!ok) {
      throw new ServiceUnavailableException(
        'Group membership is pending authorization synchronization',
      );
    }
    return { ...membership, syncStatus: 'synced', syncError: null, syncedAt: new Date() };
  }

  private async recordSyncResult(id: string, ok: boolean): Promise<void> {
    await this.prisma.tenantGroupMembership.updateMany({
      where: { id, syncStatus: { in: ['pending', 'failed'] } },
      data: ok
        ? { syncStatus: 'synced', syncError: null, syncedAt: new Date() }
        : { syncStatus: 'failed', syncError: OPENFGA_SYNC_ERROR },
    });
  }

  private async requireGroup(tenantId: string, groupId: string): Promise<TenantGroupRecord> {
    const group = await this.prisma.tenantGroup.findFirst({ where: { id: groupId, tenantId } });
    if (!group) throw new NotFoundException('Tenant group not found');
    return group;
  }

  private async assertCanManage(tenantId: string, actor: AuthenticatedUser): Promise<void> {
    if (actor.roles.some((role) => GROUP_MANAGER_ROLES.includes(role))) return;
    const owner = await this.prisma.tenantMembership.findFirst({
      where: { tenantId, userId: actor.id, role: 'owner' },
    });
    if (!owner) throw new ForbiddenException('Requires tenant-admin or tenant owner');
  }

  private async writeMutation(
    tx: Prisma.TransactionClient,
    mutation: {
      tenantId: string;
      entityId: string;
      action: string;
      eventType: DomainEventType;
      actorId: string;
      payload: Record<string, unknown>;
    },
  ): Promise<void> {
    await tx.tenantAudit.create({
      data: {
        entityType: 'TenantGroup',
        entityId: mutation.entityId,
        action: mutation.action,
        actorId: mutation.actorId,
        changes: JSON.stringify(mutation.payload),
      },
    });
    const event: DomainEvent<Record<string, unknown>> = {
      id: crypto.randomUUID(),
      type: mutation.eventType,
      pillar: 'tenant',
      tenantId: mutation.tenantId,
      occurredAt: new Date().toISOString(),
      payload: mutation.payload,
    };
    await tx.tenantOutbox.create({
      data: {
        eventType: event.type,
        payload: JSON.stringify(event),
        occurredAt: new Date(event.occurredAt),
      },
    });
  }
}
