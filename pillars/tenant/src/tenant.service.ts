import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { DomainEvent } from '@poc-plattform-kit/events';
import { PrismaService } from '@poc-plattform-kit/db';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { ListTenantsQueryDto } from './dto/list-tenants-query.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { TenancyContext } from './tenancy.context';
import { SLUG_PATTERN, slugify } from './slug.util';

/** Bound on deterministic -N suffix retries when a slug is auto-generated. */
const MAX_GENERATED_SLUG_ATTEMPTS = 50;

type TenantRow = {
  id: string;
  name: string;
  slug: string;
  settings: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type TenantRecord = {
  id: string;
  name: string;
  slug: string;
  settings: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
};

export type TenantListPage = {
  items: TenantRecord[];
  nextCursor: string | null;
};

export type TenantMembershipRecord = {
  id: string;
  tenantId: string;
  userId: string;
  role: string;
  createdAt: Date;
};

function isUniqueConflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'P2002'
  );
}

function parseSettings(raw: string | null): Record<string, unknown> | null {
  if (raw === null) {
    return null;
  }
  return JSON.parse(raw) as Record<string, unknown>;
}

function toTenantRecord(row: TenantRow): TenantRecord {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    settings: parseSettings(row.settings),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class TenantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenancy: TenancyContext,
  ) {}

  async findAll(query: ListTenantsQueryDto): Promise<TenantListPage> {
    const q = query.q?.trim();
    const take = Math.min(query.limit ?? 25, 100);

    const tenants = await this.prisma.tenant.findMany({
      ...(q
        ? {
            where: {
              OR: [{ name: { contains: q } }, { slug: { contains: q } }],
            },
          }
        : {}),
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      // Fetch one extra row to detect whether another page follows, without a separate count query.
      take: take + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });

    const hasMore = tenants.length > take;
    const page = hasMore ? tenants.slice(0, take) : tenants;
    const nextCursor = hasMore ? page[page.length - 1].id : null;

    return { items: page.map(toTenantRecord), nextCursor };
  }

  async create(dto: CreateTenantDto, actorUserId: string): Promise<TenantRecord> {
    const settings = dto.settings ? JSON.stringify(dto.settings) : null;
    const explicitSlug = dto.slug?.trim();

    if (explicitSlug && !SLUG_PATTERN.test(explicitSlug)) {
      throw new BadRequestException('slug must be lowercase alphanumeric with optional hyphens');
    }

    const base = explicitSlug || slugify(dto.name);
    const maxAttempts = explicitSlug ? 1 : MAX_GENERATED_SLUG_ATTEMPTS;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const candidateSlug = attempt === 1 ? base : `${base}-${attempt}`;

      try {
        const tenant = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          const created = await tx.tenant.create({
            data: {
              name: dto.name,
              slug: candidateSlug,
              settings,
            },
          });

          await tx.tenantAudit.create({
            data: {
              entityType: 'Tenant',
              entityId: created.id,
              action: 'created',
              changes: JSON.stringify({
                name: created.name,
                slug: created.slug,
                settings: created.settings,
              }),
            },
          });

          const createdEvent: DomainEvent<{ name: string; slug: string }> = {
            id: crypto.randomUUID(),
            type: 'tenant.created',
            pillar: 'tenant',
            tenantId: created.id,
            occurredAt: new Date().toISOString(),
            payload: { name: created.name, slug: created.slug },
          };

          await tx.tenantOutbox.create({
            data: {
              eventType: createdEvent.type,
              payload: JSON.stringify(createdEvent),
              occurredAt: new Date(createdEvent.occurredAt),
            },
          });

          // The creator becomes the tenant's owner; a durable membership row
          // gives invitations and future per-tenant roles somewhere to
          // attach. Fine-grained authZ stays with the Permissions pillar
          // (OpenFGA) -- this is identity/membership only.
          await tx.tenantMembership.create({
            data: {
              tenantId: created.id,
              userId: actorUserId,
              role: 'owner',
            },
          });

          const memberAddedEvent: DomainEvent<{ userId: string; role: string }> = {
            id: crypto.randomUUID(),
            type: 'tenant.member_added',
            pillar: 'tenant',
            tenantId: created.id,
            occurredAt: new Date().toISOString(),
            payload: { userId: actorUserId, role: 'owner' },
          };

          await tx.tenantOutbox.create({
            data: {
              eventType: memberAddedEvent.type,
              payload: JSON.stringify(memberAddedEvent),
              occurredAt: new Date(memberAddedEvent.occurredAt),
            },
          });

          return created;
        });

        return toTenantRecord(tenant);
      } catch (error: unknown) {
        const isLastAttempt = attempt === maxAttempts;
        if (isUniqueConflict(error) && !isLastAttempt) {
          continue;
        }
        if (isUniqueConflict(error)) {
          throw new ConflictException('Tenant slug already exists');
        }
        throw error;
      }
    }

    /* istanbul ignore next -- loop always returns or throws */
    throw new ConflictException('Tenant slug already exists');
  }

  async findOne(id: string): Promise<TenantRecord> {
    this.assertTenantAccess(id);
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    return toTenantRecord(tenant);
  }

  async update(id: string, dto: UpdateTenantDto): Promise<TenantRecord> {
    this.assertTenantAccess(id);

    const existing = await this.prisma.tenant.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Tenant not found');
    }

    const settings =
      dto.settings === undefined
        ? undefined
        : dto.settings === null
          ? null
          : JSON.stringify(dto.settings);

    const tenant = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updated = await tx.tenant.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(settings !== undefined ? { settings } : {}),
        },
      });

      await tx.tenantAudit.create({
        data: {
          entityType: 'Tenant',
          entityId: updated.id,
          action: 'updated',
          changes: JSON.stringify(dto),
        },
      });

      const event: DomainEvent<{ name: string; slug: string }> = {
        id: crypto.randomUUID(),
        type: 'tenant.updated',
        pillar: 'tenant',
        tenantId: updated.id,
        occurredAt: new Date().toISOString(),
        payload: { name: updated.name, slug: updated.slug },
      };

      await tx.tenantOutbox.create({
        data: {
          eventType: event.type,
          payload: JSON.stringify(event),
          occurredAt: new Date(event.occurredAt),
        },
      });

      return updated;
    });

    return toTenantRecord(tenant);
  }

  /** Used by the invitation-accept flow to attach a new membership row. */
  async listMemberships(tenantId: string): Promise<TenantMembershipRecord[]> {
    return this.prisma.tenantMembership.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });
  }

  private assertTenantAccess(id: string): void {
    const contextTenantId = this.tenancy.requireTenantId();
    if (contextTenantId !== id) {
      throw new ForbiddenException('Tenant context does not match requested tenant');
    }
  }
}
