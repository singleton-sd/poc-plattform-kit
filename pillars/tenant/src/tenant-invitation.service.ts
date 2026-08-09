import { randomBytes } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { DomainEvent } from '@poc-plattform-kit/events';
import { PrismaService } from '@poc-plattform-kit/db';
import type { AuthenticatedUser } from '@poc-plattform-kit/pillar-single-sign-on';
import { CreateTenantInvitationDto } from './dto/create-tenant-invitation.dto';

/** Sane default window an invitation stays open before it's treated as expired. */
const INVITATION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * COARSE GUARD (temporary): global roles that may manage invitations for any
 * tenant. Fine-grained authZ belongs to the Permissions pillar (OpenFGA
 * `Check(subject, action, resource)`) -- this list is a stand-in until that
 * epic lands and must not grow beyond what this ticket needs.
 */
const COARSE_INVITATION_MANAGER_ROLES = ['tenant-admin', 'support-agent'];

type TenantInvitationRow = {
  id: string;
  tenantId: string;
  email: string;
  role: string;
  invitedByUserId: string;
  token: string;
  status: string;
  expiresAt: Date;
  createdAt: Date;
  respondedAt: Date | null;
};

export type TenantInvitationRecord = Omit<TenantInvitationRow, 'token'>;

function toInvitationRecord(row: TenantInvitationRow): TenantInvitationRecord {
  const { token: _token, ...record } = row;
  return record;
}

@Injectable()
export class TenantInvitationService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    tenantId: string,
    dto: CreateTenantInvitationDto,
    actor: AuthenticatedUser,
  ): Promise<TenantInvitationRecord> {
    await this.assertCanManageInvitations(tenantId, actor);

    const email = dto.email.trim().toLowerCase();

    const existingPending = await this.prisma.tenantInvitation.findFirst({
      where: { tenantId, email, status: 'pending' },
    });
    if (existingPending) {
      throw new ConflictException('A pending invitation already exists for this tenant and email');
    }

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_MS);

    const invitation = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const created = await tx.tenantInvitation.create({
        data: {
          tenantId,
          email,
          role: dto.role,
          invitedByUserId: actor.id,
          token,
          status: 'pending',
          expiresAt,
        },
      });

      await tx.tenantAudit.create({
        data: {
          entityType: 'TenantInvitation',
          entityId: created.id,
          action: 'created',
          actorId: actor.id,
          changes: JSON.stringify({ email: created.email, role: created.role }),
        },
      });

      const event: DomainEvent<{
        invitationId: string;
        tenantId: string;
        email: string;
        role: string;
        token: string;
      }> = {
        id: crypto.randomUUID(),
        type: 'tenant.invitation_created',
        pillar: 'tenant',
        tenantId,
        occurredAt: new Date().toISOString(),
        // The Notifications ticket (86d3zetkq) consumes this event to send
        // the invite email; the raw token only ever travels this way.
        payload: {
          invitationId: created.id,
          tenantId,
          email: created.email,
          role: created.role,
          token,
        },
      };

      await tx.tenantOutbox.create({
        data: {
          eventType: event.type,
          payload: JSON.stringify(event),
          occurredAt: new Date(event.occurredAt),
        },
      });

      return created;
    });

    return toInvitationRecord(invitation);
  }

  async findAllForTenant(
    tenantId: string,
    actor: AuthenticatedUser,
  ): Promise<TenantInvitationRecord[]> {
    await this.assertCanManageInvitations(tenantId, actor);

    const rows = await this.prisma.tenantInvitation.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });

    return rows.map(toInvitationRecord);
  }

  async revoke(tenantId: string, invitationId: string, actor: AuthenticatedUser): Promise<void> {
    await this.assertCanManageInvitations(tenantId, actor);

    const invitation = await this.prisma.tenantInvitation.findFirst({
      where: { id: invitationId, tenantId },
    });
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }
    if (invitation.status !== 'pending') {
      throw new ConflictException('Only pending invitations can be revoked');
    }

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.tenantInvitation.update({
        where: { id: invitationId },
        data: { status: 'revoked', respondedAt: new Date() },
      });

      await tx.tenantAudit.create({
        data: {
          entityType: 'TenantInvitation',
          entityId: invitationId,
          action: 'revoked',
          actorId: actor.id,
          changes: JSON.stringify({ status: 'revoked' }),
        },
      });
    });
  }

  /**
   * COARSE GUARD (temporary): allow the global tenant-admin/support-agent
   * roles, or a caller with a TenantMembership row of role "owner" on this
   * tenant. This intentionally does not call the Permissions pillar --
   * fine-grained authZ (OpenFGA) is a separate epic; do not extend this
   * method with more rules, replace it there instead.
   */
  private async assertCanManageInvitations(
    tenantId: string,
    actor: AuthenticatedUser,
  ): Promise<void> {
    if (actor.roles.some((role) => COARSE_INVITATION_MANAGER_ROLES.includes(role))) {
      return;
    }

    const ownerMembership = await this.prisma.tenantMembership.findFirst({
      where: { tenantId, userId: actor.id, role: 'owner' },
    });
    if (!ownerMembership) {
      throw new ForbiddenException(
        'Requires tenant-admin/support-agent role or an owner membership on this tenant',
      );
    }
  }
}
