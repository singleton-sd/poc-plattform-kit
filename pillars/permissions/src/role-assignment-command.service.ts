import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  OnApplicationBootstrap,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@poc-plattform-kit/db';
import type { DomainEvent } from '@poc-plattform-kit/events';
import { createHash, randomUUID } from 'node:crypto';
import { PermissionsService } from './permissions.service';

export type RolePrincipalType = 'user' | 'group';
export type RoleAssignmentCommand = {
  tenantId: string;
  principalType: RolePrincipalType;
  principalId: string;
  roleId: string;
  assigned: boolean;
  actorId: string;
  idempotencyKey: string;
  ifMatch: string;
  protectLastOwner?: boolean;
};
export type RoleAssignmentCommandResult = {
  consistencyVersion: string;
  changed: boolean;
  assigned: boolean;
};
const version = (revision: number) => `roles:${revision}`;
const principalSubject = (c: RoleAssignmentCommand) =>
  c.principalType === 'user' ? `user:${c.principalId}` : `group:${c.principalId}#member`;
const hashCommand = (c: RoleAssignmentCommand) =>
  createHash('sha256')
    .update(
      [c.tenantId, c.principalType, c.principalId, c.roleId, c.assigned ? 'assign' : 'revoke'].join(
        '|',
      ),
    )
    .digest('hex');

@Injectable()
export class RoleAssignmentCommandService implements OnApplicationBootstrap, OnModuleDestroy {
  private reconciliationTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  onApplicationBootstrap(): void {
    this.reconciliationTimer = setInterval(() => void this.reconcilePending(), 60_000);
    this.reconciliationTimer.unref();
  }

  onModuleDestroy(): void {
    if (this.reconciliationTimer) clearInterval(this.reconciliationTimer);
  }

  async reconcilePending(limit = 50): Promise<{ attempted: number; synced: number }> {
    const pending = await this.prisma.permissionsRoleAssignment.findMany({
      where: { syncStatus: { in: ['pending', 'failed'] } },
      orderBy: { updatedAt: 'asc' },
      take: limit,
    });
    let synced = 0;
    for (const assignment of pending) {
      const ok = await this.permissions.setTenantRole(
        assignment.principalType === 'user'
          ? `user:${assignment.principalId}`
          : `group:${assignment.principalId}#member`,
        assignment.roleId,
        assignment.tenantId,
        assignment.assigned,
      );
      await this.prisma.permissionsRoleAssignment.update({
        where: { id: assignment.id },
        data: ok
          ? { syncStatus: 'synced', syncError: null, syncedAt: new Date() }
          : { syncStatus: 'failed', syncError: 'OpenFGA role write failed', syncedAt: null },
      });
      if (ok) synced += 1;
    }
    return { attempted: pending.length, synced };
  }

  async currentVersion(tenantId: string): Promise<string> {
    const row = await this.prisma.permissionsRoleRevision.findUnique({ where: { tenantId } });
    return version(row?.revision ?? 0);
  }

  async listAssignments(tenantId: string) {
    return this.prisma.permissionsRoleAssignment.findMany({
      where: { tenantId, assigned: true, syncStatus: 'synced' },
    });
  }

  async execute(command: RoleAssignmentCommand): Promise<RoleAssignmentCommandResult> {
    const hash = hashCommand(command);
    const replay = await this.prisma.permissionsRoleCommand.findUnique({
      where: {
        tenantId_idempotencyKey: {
          tenantId: command.tenantId,
          idempotencyKey: command.idempotencyKey,
        },
      },
    });
    if (replay) return this.replay(replay, hash, command);

    const stored = await this.runSerializable(command, hash);
    if (stored.command.commandHash !== hash)
      throw new ConflictException('Idempotency-Key was already used for another command');
    if (stored.needsSync) await this.synchronize(stored.assignmentId, command);
    return {
      consistencyVersion: stored.command.consistencyVersion,
      changed: stored.command.changed,
      assigned: stored.command.assigned,
    };
  }

  async replayIfPresent(
    command: RoleAssignmentCommand,
  ): Promise<RoleAssignmentCommandResult | undefined> {
    const row = await this.prisma.permissionsRoleCommand.findUnique({
      where: {
        tenantId_idempotencyKey: {
          tenantId: command.tenantId,
          idempotencyKey: command.idempotencyKey,
        },
      },
    });
    return row ? this.replay(row, hashCommand(command), command) : undefined;
  }

  private async runSerializable(command: RoleAssignmentCommand, hash: string) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.transaction(command, hash);
      } catch (error) {
        const concurrency =
          typeof error === 'object' &&
          error !== null &&
          (('code' in error && (error as { code?: unknown }).code === 'P2034') ||
            ('number' in error && (error as { number?: unknown }).number === 1205));
        if (!concurrency) throw error;
        if (attempt === 2)
          throw new HttpException(
            'The access assignment version is stale',
            HttpStatus.PRECONDITION_FAILED,
          );
      }
    }
    throw new HttpException(
      'The access assignment version is stale',
      HttpStatus.PRECONDITION_FAILED,
    );
  }

  private transaction(command: RoleAssignmentCommand, hash: string) {
    return this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const raced = await tx.permissionsRoleCommand.findUnique({
          where: {
            tenantId_idempotencyKey: {
              tenantId: command.tenantId,
              idempotencyKey: command.idempotencyKey,
            },
          },
        });
        if (raced)
          return { command: raced, assignmentId: raced.assignmentId, needsSync: raced.changed };
        const revision = await tx.permissionsRoleRevision.upsert({
          where: { tenantId: command.tenantId },
          create: { tenantId: command.tenantId, revision: 0 },
          update: {},
        });
        if (command.ifMatch !== version(revision.revision))
          throw new HttpException(
            'The access assignment version is stale',
            HttpStatus.PRECONDITION_FAILED,
          );
        if (command.protectLastOwner && !command.assigned)
          await this.assertEffectiveOwnerRemains(tx, command);
        const where = {
          tenantId_principalType_principalId_roleId: {
            tenantId: command.tenantId,
            principalType: command.principalType,
            principalId: command.principalId,
            roleId: command.roleId,
          },
        };
        const existing = await tx.permissionsRoleAssignment.findUnique({ where });
        const changed = (existing?.assigned ?? false) !== command.assigned;
        const nextRevision = changed
          ? (
              await tx.permissionsRoleRevision.update({
                where: { tenantId: command.tenantId },
                data: { revision: { increment: 1 } },
              })
            ).revision
          : revision.revision;
        const assignment = await tx.permissionsRoleAssignment.upsert({
          where,
          create: {
            tenantId: command.tenantId,
            principalType: command.principalType,
            principalId: command.principalId,
            roleId: command.roleId,
            assigned: command.assigned,
            revision: nextRevision,
          },
          update: changed
            ? {
                assigned: command.assigned,
                revision: nextRevision,
                syncStatus: 'pending',
                syncError: null,
                syncedAt: null,
              }
            : {},
        });
        const consistencyVersion = version(nextRevision);
        const recorded = await tx.permissionsRoleCommand.create({
          data: {
            tenantId: command.tenantId,
            idempotencyKey: command.idempotencyKey,
            commandHash: hash,
            assignmentId: assignment.id,
            consistencyVersion,
            changed,
            assigned: command.assigned,
          },
        });
        if (changed) {
          const eventType = command.assigned
            ? 'permission.role_assigned'
            : 'permission.role_revoked';
          const safe = {
            tenantId: command.tenantId,
            principalType: command.principalType,
            principalId: command.principalId,
            roleId: command.roleId,
            revision: nextRevision,
          };
          await tx.permissionsAudit.create({
            data: {
              entityType: 'RoleAssignment',
              entityId: assignment.id,
              action: command.assigned ? 'role_assigned' : 'role_revoked',
              actorId: command.actorId,
              changes: JSON.stringify(safe),
            },
          });
          const event: DomainEvent = {
            id: randomUUID(),
            type: eventType,
            pillar: 'permissions',
            tenantId: command.tenantId,
            occurredAt: new Date().toISOString(),
            payload: safe,
          };
          await tx.permissionsOutbox.create({
            data: {
              eventType,
              payload: JSON.stringify(event),
              occurredAt: new Date(event.occurredAt),
            },
          });
        }
        return { command: recorded, assignmentId: assignment.id, needsSync: changed };
      },
      { isolationLevel: 'Serializable' },
    );
  }

  private async assertEffectiveOwnerRemains(
    tx: Prisma.TransactionClient,
    command: RoleAssignmentCommand,
  ): Promise<void> {
    const memberships = await tx.tenantMembership.findMany({
      where: { tenantId: command.tenantId },
    });
    const assignments = await tx.permissionsRoleAssignment.findMany({
      where: { tenantId: command.tenantId, roleId: 'owner', assigned: true, syncStatus: 'synced' },
    });
    const groupMembers = await tx.tenantGroupMembership.findMany({
      where: { tenantId: command.tenantId, syncStatus: 'synced' },
    });
    const humans = new Set(memberships.filter((m) => m.role === 'owner').map((m) => m.userId));
    for (const assignment of assignments) {
      if (assignment.principalType === 'user') humans.add(assignment.principalId);
      else
        groupMembers
          .filter((m) => m.groupId === assignment.principalId)
          .forEach((m) => humans.add(m.userId));
    }
    if (command.principalType === 'user') {
      const other =
        memberships.some((m) => m.userId === command.principalId && m.role === 'owner') ||
        assignments.some(
          (a) =>
            a.principalType === 'group' &&
            groupMembers.some(
              (m) => m.groupId === a.principalId && m.userId === command.principalId,
            ),
        );
      if (!other) humans.delete(command.principalId);
    } else {
      for (const member of groupMembers.filter((m) => m.groupId === command.principalId)) {
        const other =
          memberships.some((x) => x.userId === member.userId && x.role === 'owner') ||
          assignments.some((a) => a.principalType === 'user' && a.principalId === member.userId) ||
          assignments.some(
            (a) =>
              a.principalType === 'group' &&
              a.principalId !== command.principalId &&
              groupMembers.some((m) => m.groupId === a.principalId && m.userId === member.userId),
          );
        if (!other) humans.delete(member.userId);
      }
    }
    if (!humans.size) throw new ConflictException('A tenant must retain an owner');
  }

  private async replay(
    row: {
      commandHash: string;
      assignmentId: string;
      consistencyVersion: string;
      changed: boolean;
      assigned: boolean;
    },
    hash: string,
    command: RoleAssignmentCommand,
  ): Promise<RoleAssignmentCommandResult> {
    if (row.commandHash !== hash)
      throw new ConflictException('Idempotency-Key was already used for another command');
    if (row.changed) await this.synchronize(row.assignmentId, command);
    return {
      consistencyVersion: row.consistencyVersion,
      changed: row.changed,
      assigned: row.assigned,
    };
  }

  private async synchronize(assignmentId: string, command: RoleAssignmentCommand): Promise<void> {
    const assignment = await this.prisma.permissionsRoleAssignment.findUnique({
      where: { id: assignmentId },
    });
    if (assignment?.syncStatus === 'synced') return;
    const ok = await this.permissions.setTenantRole(
      principalSubject(command),
      command.roleId,
      command.tenantId,
      command.assigned,
    );
    await this.prisma.permissionsRoleAssignment.update({
      where: { id: assignmentId },
      data: ok
        ? { syncStatus: 'synced', syncError: null, syncedAt: new Date() }
        : { syncStatus: 'failed', syncError: 'OpenFGA role write failed', syncedAt: null },
    });
    if (!ok) throw new ServiceUnavailableException('Role assignment is pending reconciliation');
  }
}
