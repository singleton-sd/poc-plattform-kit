import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@poc-plattform-kit/db';
import type { DomainEvent } from '@poc-plattform-kit/events';
import type { AuthenticatedUser } from '@poc-plattform-kit/pillar-single-sign-on';
import { ApproveAccessRequestDto } from './dto/approve-access-request.dto';
import { CreateAccessRequestDto } from './dto/create-access-request.dto';
import { DenyAccessRequestDto } from './dto/deny-access-request.dto';
import { PermissionGrantType } from './dto/grant-permission.dto';
import { ManagerChainService } from './manager-chain.service';
import { PermissionsService } from './permissions.service';

export type AccessRequestStatus = 'pending' | 'approving' | 'approved' | 'denied' | 'expired';

export type AccessRequestRecord = {
  id: string;
  tenantId: string;
  requesterId: string;
  requesterEntraOid: string;
  action: string;
  resource: string;
  status: AccessRequestStatus;
  decidedById: string | null;
  decidedAt: Date | null;
  denyReason: string | null;
  grantType: string | null;
  requestExpiresAt: Date | null;
  grantExpiresAt: Date | null;
  preferredGrantType: string | null;
  preferredGrantExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type AccessRequestRow = {
  id: string;
  tenantId: string;
  requesterId: string;
  requesterEntraOid: string;
  action: string;
  resource: string;
  status: string;
  decidedById: string | null;
  decidedAt: Date | null;
  denyReason: string | null;
  grantType: string | null;
  requestExpiresAt: Date | null;
  grantExpiresAt: Date | null;
  preferredGrantType: string | null;
  preferredGrantExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type AccessRequestCreatedPayload = {
  requestId: string;
  requesterId: string;
  requesterEntraOid: string;
  action: string;
  resource: string;
  managerEntraOids: string[];
};

type AccessRequestDecidedPayload = {
  requestId: string;
  requesterId: string;
  decidedById: string;
  action: string;
  resource: string;
  grantType?: string;
  denyReason?: string | null;
};

function toRecord(row: AccessRequestRow): AccessRequestRecord {
  return {
    ...row,
    status: row.status as AccessRequestStatus,
  };
}

function isPendingExpired(row: AccessRequestRow, now: Date): boolean {
  return (
    row.status === 'pending' &&
    row.requestExpiresAt !== null &&
    row.requestExpiresAt.getTime() <= now.getTime()
  );
}

@Injectable()
export class AccessRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
    private readonly managerChain: ManagerChainService,
  ) {}

  async create(
    dto: CreateAccessRequestDto,
    actor: AuthenticatedUser,
  ): Promise<AccessRequestRecord> {
    const tenantId = await this.resolveCreateTenantId(dto, actor);

    let requestExpiresAt: Date | null = null;
    if (dto.requestExpiresAt) {
      requestExpiresAt = new Date(dto.requestExpiresAt);
      if (Number.isNaN(requestExpiresAt.getTime()) || requestExpiresAt.getTime() <= Date.now()) {
        throw new BadRequestException('requestExpiresAt must be a future ISO-8601 timestamp');
      }
    }

    let preferredGrantExpiresAt: Date | null = null;
    if (dto.preferredGrantType === PermissionGrantType.Temporary) {
      if (!dto.preferredGrantExpiresAt) {
        throw new BadRequestException(
          'preferredGrantExpiresAt is required when preferredGrantType is temporary',
        );
      }
      preferredGrantExpiresAt = new Date(dto.preferredGrantExpiresAt);
      if (
        Number.isNaN(preferredGrantExpiresAt.getTime()) ||
        preferredGrantExpiresAt.getTime() <= Date.now()
      ) {
        throw new BadRequestException(
          'preferredGrantExpiresAt must be a future ISO-8601 timestamp',
        );
      }
    }

    const existingPending = await this.prisma.accessRequest.findFirst({
      where: {
        requesterId: actor.id,
        action: dto.action,
        resource: dto.resource,
        status: 'pending',
        OR: [{ requestExpiresAt: null }, { requestExpiresAt: { gt: new Date() } }],
      },
      orderBy: [{ createdAt: 'desc' }],
    });
    if (existingPending) {
      return toRecord(existingPending);
    }

    const managerEntraOids = await this.managerChain.getManagerChain(actor.entraOid);

    const created = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const row = await tx.accessRequest.create({
        data: {
          tenantId,
          requesterId: actor.id,
          requesterEntraOid: actor.entraOid,
          action: dto.action,
          resource: dto.resource,
          status: 'pending',
          requestExpiresAt,
          preferredGrantType: dto.preferredGrantType ?? null,
          preferredGrantExpiresAt,
        },
      });

      await tx.permissionsAudit.create({
        data: {
          entityType: 'AccessRequest',
          entityId: row.id,
          action: 'created',
          actorId: actor.id,
          changes: JSON.stringify({
            tenantId,
            action: row.action,
            resource: row.resource,
            requestExpiresAt: row.requestExpiresAt?.toISOString() ?? null,
            preferredGrantType: row.preferredGrantType,
            preferredGrantExpiresAt: row.preferredGrantExpiresAt?.toISOString() ?? null,
          }),
        },
      });

      const event: DomainEvent<AccessRequestCreatedPayload> = {
        id: crypto.randomUUID(),
        type: 'permission.access_requested',
        pillar: 'permissions',
        tenantId,
        occurredAt: new Date().toISOString(),
        payload: {
          requestId: row.id,
          requesterId: actor.id,
          requesterEntraOid: actor.entraOid,
          action: row.action,
          resource: row.resource,
          managerEntraOids,
        },
      };

      await tx.permissionsOutbox.create({
        data: {
          eventType: event.type,
          payload: JSON.stringify(event),
          occurredAt: new Date(event.occurredAt),
        },
      });

      return row;
    });

    return toRecord(created);
  }

  async listMine(
    actor: AuthenticatedUser,
    query: { action?: string; resource?: string },
  ): Promise<AccessRequestRecord[]> {
    const rows = await this.prisma.accessRequest.findMany({
      where: {
        requesterId: actor.id,
        ...(query.action ? { action: query.action } : {}),
        ...(query.resource ? { resource: query.resource } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50,
    });
    return rows.map(toRecord);
  }

  async listPendingForApprover(actor: AuthenticatedUser): Promise<AccessRequestRecord[]> {
    const tenantId = actor.tenantId?.trim();
    if (!tenantId) {
      throw new BadRequestException('tenant claim required to list pending access requests');
    }

    const now = new Date();
    const pending = await this.prisma.accessRequest.findMany({
      where: {
        tenantId,
        status: 'pending',
        OR: [{ requestExpiresAt: null }, { requestExpiresAt: { gt: now } }],
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    const admin = await this.permissions.check({
      subject: `user:${actor.id}`,
      action: 'admin',
      resource: `tenant:${tenantId}`,
    });
    if (admin.allowed) {
      return pending.map(toRecord);
    }

    const chainByRequester = new Map<string, string[]>();
    const visible: AccessRequestRecord[] = [];
    for (const row of pending) {
      let chain = chainByRequester.get(row.requesterEntraOid);
      if (!chain) {
        chain = await this.managerChain.getManagerChain(row.requesterEntraOid);
        chainByRequester.set(row.requesterEntraOid, chain);
      }
      if (chain.includes(actor.entraOid)) {
        visible.push(toRecord(row));
      }
    }
    return visible;
  }

  async approve(
    id: string,
    dto: ApproveAccessRequestDto,
    actor: AuthenticatedUser,
  ): Promise<AccessRequestRecord> {
    const row = await this.requirePendingDecision(id, actor);

    if (dto.grantType === PermissionGrantType.Temporary && !dto.expiresAt) {
      throw new BadRequestException('expiresAt is required for temporary grants');
    }

    const grantExpiresAt =
      dto.grantType === PermissionGrantType.Temporary && dto.expiresAt
        ? new Date(dto.expiresAt)
        : null;
    if (
      dto.grantType === PermissionGrantType.Temporary &&
      (grantExpiresAt === null ||
        Number.isNaN(grantExpiresAt.getTime()) ||
        grantExpiresAt.getTime() <= Date.now())
    ) {
      throw new BadRequestException('expiresAt must be a future ISO-8601 timestamp');
    }

    const claimed = await this.prisma.accessRequest.updateMany({
      where: { id: row.id, status: 'pending' },
      data: { status: 'approving', decidedById: actor.id },
    });
    if (claimed.count === 0) {
      throw new ConflictException('Access request is no longer pending');
    }

    const grantSubject = `user:${row.requesterId}`;
    let granted = false;
    try {
      const grantResult = await this.permissions.grant({
        subject: grantSubject,
        action: row.action,
        resource: row.resource,
        grantType: dto.grantType,
        ...(grantExpiresAt ? { expiresAt: grantExpiresAt.toISOString() } : {}),
      });
      if (!grantResult.granted) {
        throw new BadRequestException('Grant API declined the permission write');
      }
      granted = true;

      const decidedAt = new Date();
      const updated = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const finalize = await tx.accessRequest.updateMany({
          where: { id: row.id, status: 'approving', decidedById: actor.id },
          data: {
            status: 'approved',
            decidedAt,
            grantType: dto.grantType,
            grantExpiresAt,
          },
        });
        if (finalize.count === 0) {
          throw new ConflictException('Access request approval claim was lost');
        }

        const next = await tx.accessRequest.findUniqueOrThrow({ where: { id: row.id } });

        await tx.permissionsAudit.create({
          data: {
            entityType: 'AccessRequest',
            entityId: next.id,
            action: 'approved',
            actorId: actor.id,
            changes: JSON.stringify({
              grantType: dto.grantType,
              grantExpiresAt: grantExpiresAt?.toISOString() ?? null,
            }),
          },
        });

        const approvedEvent: DomainEvent<AccessRequestDecidedPayload> = {
          id: crypto.randomUUID(),
          type: 'permission.access_approved',
          pillar: 'permissions',
          tenantId: next.tenantId,
          occurredAt: decidedAt.toISOString(),
          payload: {
            requestId: next.id,
            requesterId: next.requesterId,
            decidedById: actor.id,
            action: next.action,
            resource: next.resource,
            grantType: dto.grantType,
          },
        };

        await tx.permissionsOutbox.create({
          data: {
            eventType: approvedEvent.type,
            payload: JSON.stringify(approvedEvent),
            occurredAt: decidedAt,
          },
        });

        const grantedEvent: DomainEvent<{
          subject: string;
          action: string;
          resource: string;
          grantType: string;
        }> = {
          id: crypto.randomUUID(),
          type: 'permission.granted',
          pillar: 'permissions',
          tenantId: next.tenantId,
          occurredAt: decidedAt.toISOString(),
          payload: {
            subject: grantSubject,
            action: next.action,
            resource: next.resource,
            grantType: dto.grantType,
          },
        };

        await tx.permissionsOutbox.create({
          data: {
            eventType: grantedEvent.type,
            payload: JSON.stringify(grantedEvent),
            occurredAt: decidedAt,
          },
        });

        return next;
      });

      return toRecord(updated);
    } catch (error) {
      if (granted) {
        await this.permissions.revoke({
          subject: grantSubject,
          action: row.action,
          resource: row.resource,
        });
      }
      await this.rollbackApproving(row.id);
      throw error;
    }
  }

  async deny(
    id: string,
    dto: DenyAccessRequestDto,
    actor: AuthenticatedUser,
  ): Promise<AccessRequestRecord> {
    const row = await this.requirePendingDecision(id, actor);
    const decidedAt = new Date();
    const denyReason = dto.reason?.trim() || null;

    const updated = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const claimed = await tx.accessRequest.updateMany({
        where: { id: row.id, status: 'pending' },
        data: {
          status: 'denied',
          decidedById: actor.id,
          decidedAt,
          denyReason,
        },
      });
      if (claimed.count === 0) {
        throw new ConflictException('Access request is no longer pending');
      }

      const next = await tx.accessRequest.findUniqueOrThrow({ where: { id: row.id } });

      await tx.permissionsAudit.create({
        data: {
          entityType: 'AccessRequest',
          entityId: next.id,
          action: 'denied',
          actorId: actor.id,
          changes: JSON.stringify({ denyReason }),
        },
      });

      const event: DomainEvent<AccessRequestDecidedPayload> = {
        id: crypto.randomUUID(),
        type: 'permission.access_denied',
        pillar: 'permissions',
        tenantId: next.tenantId,
        occurredAt: decidedAt.toISOString(),
        payload: {
          requestId: next.id,
          requesterId: next.requesterId,
          decidedById: actor.id,
          action: next.action,
          resource: next.resource,
          denyReason,
        },
      };

      await tx.permissionsOutbox.create({
        data: {
          eventType: event.type,
          payload: JSON.stringify(event),
          occurredAt: decidedAt,
        },
      });

      return next;
    });

    return toRecord(updated);
  }

  private async resolveCreateTenantId(
    dto: CreateAccessRequestDto,
    actor: AuthenticatedUser,
  ): Promise<string> {
    const sessionTenant = actor.tenantId?.trim() || null;
    const bodyTenant = dto.tenantId?.trim() || null;

    if (!sessionTenant && !bodyTenant) {
      throw new BadRequestException('tenantId is required when the session has no tenant claim');
    }

    if (!bodyTenant || bodyTenant === sessionTenant) {
      if (!sessionTenant) {
        throw new BadRequestException('tenant claim required to create an access request');
      }
      return sessionTenant;
    }

    // Body override to a different tenant — require membership.
    const membership = await this.prisma.tenantMembership.findFirst({
      where: { tenantId: bodyTenant, userId: actor.id },
    });
    if (!membership) {
      throw new ForbiddenException('Not a member of the requested tenant');
    }
    return bodyTenant;
  }

  private async requirePendingDecision(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<AccessRequestRow> {
    const row = await this.prisma.accessRequest.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Access request ${id} not found`);
    }

    if (actor.id === row.requesterId) {
      throw new ForbiddenException('Cannot approve or deny your own access request');
    }

    if (isPendingExpired(row, new Date())) {
      await this.markExpired(row, actor.id);
      throw new GoneException('Access request has expired');
    }

    if (row.status !== 'pending') {
      throw new BadRequestException(`Access request is already ${row.status}`);
    }

    if (!(await this.isEligibleApprover(actor, row))) {
      throw new ForbiddenException('Not an eligible approver for this access request');
    }

    return row;
  }

  async isEligibleApprover(actor: AuthenticatedUser, row: AccessRequestRow): Promise<boolean> {
    const actorTenant = actor.tenantId?.trim();
    if (!actorTenant || actorTenant !== row.tenantId) {
      return false;
    }

    const admin = await this.permissions.check({
      subject: `user:${actor.id}`,
      action: 'admin',
      resource: `tenant:${row.tenantId}`,
    });
    if (admin.allowed) {
      return true;
    }

    const chain = await this.managerChain.getManagerChain(row.requesterEntraOid);
    return chain.includes(actor.entraOid);
  }

  private async rollbackApproving(id: string): Promise<void> {
    await this.prisma.accessRequest.updateMany({
      where: { id, status: 'approving' },
      data: { status: 'pending', decidedById: null },
    });
  }

  private async markExpired(row: AccessRequestRow, actorId: string | null): Promise<void> {
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updated = await tx.accessRequest.updateMany({
        where: { id: row.id, status: 'pending' },
        data: { status: 'expired' },
      });
      if (updated.count === 0) {
        return;
      }
      await tx.permissionsAudit.create({
        data: {
          entityType: 'AccessRequest',
          entityId: row.id,
          action: 'expired',
          actorId,
          changes: JSON.stringify({
            requestExpiresAt: row.requestExpiresAt?.toISOString() ?? null,
          }),
        },
      });
    });
  }
}
