import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { TenancyContext } from './tenancy.context';

describe('TenantService', () => {
  const tenantRow = {
    id: 't1',
    name: 'Acme',
    slug: 'acme',
    settings: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  let prisma: {
    $transaction: jest.Mock;
    tenant: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    tenantAudit: { create: jest.Mock };
    tenantOutbox: { create: jest.Mock };
  };
  let tenancy: TenancyContext;
  let service: TenantService;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(),
      tenant: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      tenantAudit: { create: jest.fn() },
      tenantOutbox: { create: jest.fn() },
    };
    tenancy = new TenancyContext();
    service = new TenantService(prisma as never, tenancy);
  });

  it('create writes tenant + audit + outbox in one transaction', async () => {
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) =>
      fn(prisma),
    );
    prisma.tenant.create.mockResolvedValue(tenantRow);
    prisma.tenantAudit.create.mockResolvedValue({});
    prisma.tenantOutbox.create.mockResolvedValue({});

    const result = await service.create({ name: 'Acme', slug: 'acme' });

    expect(result).toEqual(tenantRow);
    expect(prisma.tenant.create).toHaveBeenCalledWith({
      data: { name: 'Acme', slug: 'acme', settings: null },
    });
    expect(prisma.tenantAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entityType: 'Tenant',
          entityId: 't1',
          action: 'created',
        }),
      }),
    );
    expect(prisma.tenantOutbox.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: 'tenant.created',
        }),
      }),
    );
  });

  it('findOne requires matching tenancy context', async () => {
    prisma.tenant.findUnique.mockResolvedValue(tenantRow);

    await expect(service.findOne('t1')).rejects.toThrow(UnauthorizedException);

    await tenancy.run('other', async () => {
      await expect(service.findOne('t1')).rejects.toThrow(ForbiddenException);
    });

    await tenancy.run('t1', async () => {
      await expect(service.findOne('t1')).resolves.toEqual(tenantRow);
    });
  });

  it('findOne throws NotFound when missing', async () => {
    prisma.tenant.findUnique.mockResolvedValue(null);

    await tenancy.run('t1', async () => {
      await expect(service.findOne('t1')).rejects.toThrow(NotFoundException);
    });
  });

  it('update writes audit + outbox in one transaction', async () => {
    prisma.tenant.findUnique.mockResolvedValue(tenantRow);
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) =>
      fn(prisma),
    );
    const updated = { ...tenantRow, name: 'Acme Corp' };
    prisma.tenant.update.mockResolvedValue(updated);
    prisma.tenantAudit.create.mockResolvedValue({});
    prisma.tenantOutbox.create.mockResolvedValue({});

    await tenancy.run('t1', async () => {
      const result = await service.update('t1', { name: 'Acme Corp' });
      expect(result.name).toBe('Acme Corp');
    });

    expect(prisma.tenantOutbox.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: 'tenant.updated' }),
      }),
    );
  });
});
