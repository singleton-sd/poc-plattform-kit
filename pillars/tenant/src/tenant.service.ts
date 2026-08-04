import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { DomainEvent } from '@poc-plattform-kit/events';
import { PrismaService } from '@poc-plattform-kit/db';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { TenancyContext } from './tenancy.context';

export type TenantRecord = {
  id: string;
  name: string;
  slug: string;
  settings: string | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class TenantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenancy: TenancyContext,
  ) {}

  async create(dto: CreateTenantDto): Promise<TenantRecord> {
    const settings = dto.settings ? JSON.stringify(dto.settings) : null;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            name: dto.name,
            slug: dto.slug,
            settings,
          },
        });

        await tx.tenantAudit.create({
          data: {
            entityType: 'Tenant',
            entityId: tenant.id,
            action: 'created',
            changes: JSON.stringify({
              name: tenant.name,
              slug: tenant.slug,
              settings: tenant.settings,
            }),
          },
        });

        const event: DomainEvent<{ name: string; slug: string }> = {
          id: crypto.randomUUID(),
          type: 'tenant.created',
          pillar: 'tenant',
          tenantId: tenant.id,
          occurredAt: new Date().toISOString(),
          payload: { name: tenant.name, slug: tenant.slug },
        };

        await tx.tenantOutbox.create({
          data: {
            eventType: event.type,
            payload: JSON.stringify(event),
            occurredAt: new Date(event.occurredAt),
          },
        });

        return tenant;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
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
    return tenant;
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

    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(settings !== undefined ? { settings } : {}),
        },
      });

      await tx.tenantAudit.create({
        data: {
          entityType: 'Tenant',
          entityId: tenant.id,
          action: 'updated',
          changes: JSON.stringify(dto),
        },
      });

      const event: DomainEvent<{ name: string; slug: string }> = {
        id: crypto.randomUUID(),
        type: 'tenant.updated',
        pillar: 'tenant',
        tenantId: tenant.id,
        occurredAt: new Date().toISOString(),
        payload: { name: tenant.name, slug: tenant.slug },
      };

      await tx.tenantOutbox.create({
        data: {
          eventType: event.type,
          payload: JSON.stringify(event),
          occurredAt: new Date(event.occurredAt),
        },
      });

      return tenant;
    });
  }

  private assertTenantAccess(id: string): void {
    const contextTenantId = this.tenancy.requireTenantId();
    if (contextTenantId !== id) {
      throw new ForbiddenException('Tenant context does not match requested tenant');
    }
  }
}
