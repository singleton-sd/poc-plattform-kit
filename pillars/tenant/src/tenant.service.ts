import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { DomainEvent } from '@poc-plattform-kit/events';
import { PrismaService } from '@poc-plattform-kit/db';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { TenancyContext } from './tenancy.context';

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

  async create(dto: CreateTenantDto): Promise<TenantRecord> {
    const settings = dto.settings ? JSON.stringify(dto.settings) : null;

    try {
      const tenant = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const created = await tx.tenant.create({
          data: {
            name: dto.name,
            slug: dto.slug,
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

        const event: DomainEvent<{ name: string; slug: string }> = {
          id: crypto.randomUUID(),
          type: 'tenant.created',
          pillar: 'tenant',
          tenantId: created.id,
          occurredAt: new Date().toISOString(),
          payload: { name: created.name, slug: created.slug },
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

      return toTenantRecord(tenant);
    } catch (error: unknown) {
      if (isUniqueConflict(error)) {
        throw new ConflictException('Tenant slug already exists');
      }
      throw error;
    }
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

  private assertTenantAccess(id: string): void {
    const contextTenantId = this.tenancy.requireTenantId();
    if (contextTenantId !== id) {
      throw new ForbiddenException('Tenant context does not match requested tenant');
    }
  }
}
