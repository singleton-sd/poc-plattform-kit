import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { TenantService } from './tenant.service';
import { TenancyContext } from './tenancy.context';

function prismaKnownRequestError(code: string): Error & { code: string } {
  return Object.assign(new Error('Unique constraint failed'), { code });
}

describe('TenantService', () => {
  const tenantRow = {
    id: 't1',
    name: 'Acme',
    slug: 'acme',
    settings: null as string | null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  let prisma: {
    $transaction: jest.Mock;
    tenant: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    tenantAudit: { create: jest.Mock };
    tenantOutbox: { create: jest.Mock };
  };
  let tenancy: TenancyContext;
  let service: TenantService;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(),
      tenant: {
        findMany: jest.fn(),
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

  it('lists tenants with a capped, deterministic query', async () => {
    prisma.tenant.findMany.mockResolvedValue([tenantRow]);

    await expect(service.findAll({})).resolves.toEqual([{ ...tenantRow, settings: null }]);
    expect(prisma.tenant.findMany).toHaveBeenCalledWith({
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: 25,
    });
    expect(prisma.tenantAudit.create).not.toHaveBeenCalled();
    expect(prisma.tenantOutbox.create).not.toHaveBeenCalled();
  });

  it('searches tenant names and slugs case-insensitively', async () => {
    prisma.tenant.findMany.mockResolvedValue([]);

    await service.findAll({ q: '  ACME  ', limit: 10 });

    expect(prisma.tenant.findMany).toHaveBeenCalledWith({
      where: {
        OR: [{ name: { contains: 'ACME' } }, { slug: { contains: 'ACME' } }],
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: 10,
    });
  });

  it('caps results when called outside the validated HTTP boundary', async () => {
    prisma.tenant.findMany.mockResolvedValue([]);

    await service.findAll({ limit: 1_000 });

    expect(prisma.tenant.findMany).toHaveBeenCalledWith({
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: 100,
    });
  });

  it('create writes tenant + audit + outbox in one transaction', async () => {
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) =>
      fn(prisma),
    );
    prisma.tenant.create.mockResolvedValue({
      ...tenantRow,
      settings: JSON.stringify({ plan: 'pro' }),
    });
    prisma.tenantAudit.create.mockResolvedValue({});
    prisma.tenantOutbox.create.mockResolvedValue({});

    const result = await service.create({
      name: 'Acme',
      slug: 'acme',
      settings: { plan: 'pro' },
    });

    expect(result).toEqual({ ...tenantRow, settings: { plan: 'pro' } });
    expect(prisma.tenant.create).toHaveBeenCalledWith({
      data: {
        name: 'Acme',
        slug: 'acme',
        settings: JSON.stringify({ plan: 'pro' }),
      },
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

  it('generates a normalized slug from the name when slug is omitted', async () => {
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) =>
      fn(prisma),
    );
    prisma.tenant.create.mockResolvedValue({ ...tenantRow, name: 'Acme Pty Ltd' });
    prisma.tenantAudit.create.mockResolvedValue({});
    prisma.tenantOutbox.create.mockResolvedValue({});

    await service.create({ name: 'Acme Pty Ltd' });

    expect(prisma.tenant.create).toHaveBeenCalledWith({
      data: { name: 'Acme Pty Ltd', slug: 'acme-pty-ltd', settings: null },
    });
  });

  it('generates a slug when slug is blank', async () => {
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) =>
      fn(prisma),
    );
    prisma.tenant.create.mockResolvedValue(tenantRow);
    prisma.tenantAudit.create.mockResolvedValue({});
    prisma.tenantOutbox.create.mockResolvedValue({});

    await service.create({ name: 'Acme', slug: '   ' });

    expect(prisma.tenant.create).toHaveBeenCalledWith({
      data: { name: 'Acme', slug: 'acme', settings: null },
    });
  });

  it('retries with deterministic -N suffixes when a generated slug collides', async () => {
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) =>
      fn(prisma),
    );
    prisma.tenant.create
      .mockRejectedValueOnce(prismaKnownRequestError('P2002'))
      .mockRejectedValueOnce(prismaKnownRequestError('P2002'))
      .mockResolvedValueOnce({ ...tenantRow, slug: 'acme-3' });
    prisma.tenantAudit.create.mockResolvedValue({});
    prisma.tenantOutbox.create.mockResolvedValue({});

    const result = await service.create({ name: 'Acme' });

    expect(result.slug).toBe('acme-3');
    expect(prisma.tenant.create).toHaveBeenNthCalledWith(1, {
      data: { name: 'Acme', slug: 'acme', settings: null },
    });
    expect(prisma.tenant.create).toHaveBeenNthCalledWith(2, {
      data: { name: 'Acme', slug: 'acme-2', settings: null },
    });
    expect(prisma.tenant.create).toHaveBeenNthCalledWith(3, {
      data: { name: 'Acme', slug: 'acme-3', settings: null },
    });
  });

  it('falls back to a fixed base when the name has no latin/numeric characters', async () => {
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) =>
      fn(prisma),
    );
    prisma.tenant.create.mockResolvedValue({ ...tenantRow, slug: 'tenant' });
    prisma.tenantAudit.create.mockResolvedValue({});
    prisma.tenantOutbox.create.mockResolvedValue({});

    await service.create({ name: '日本語' });

    expect(prisma.tenant.create).toHaveBeenCalledWith({
      data: { name: '日本語', slug: 'tenant', settings: null },
    });
  });

  it('preserves an explicit slug and never falls back to generation', async () => {
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) =>
      fn(prisma),
    );
    prisma.tenant.create.mockResolvedValue({ ...tenantRow, slug: 'custom-slug' });
    prisma.tenantAudit.create.mockResolvedValue({});
    prisma.tenantOutbox.create.mockResolvedValue({});

    await service.create({ name: 'Acme', slug: 'custom-slug' });

    expect(prisma.tenant.create).toHaveBeenCalledTimes(1);
    expect(prisma.tenant.create).toHaveBeenCalledWith({
      data: { name: 'Acme', slug: 'custom-slug', settings: null },
    });
  });

  it('rejects an explicitly supplied slug with an invalid format', async () => {
    await expect(service.create({ name: 'Acme', slug: 'Not Valid!' })).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.tenant.create).not.toHaveBeenCalled();
  });

  it('rejects a duplicate explicitly supplied slug without retrying', async () => {
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) =>
      fn(prisma),
    );
    prisma.tenant.create.mockRejectedValue(prismaKnownRequestError('P2002'));

    await expect(service.create({ name: 'Acme', slug: 'acme' })).rejects.toThrow(ConflictException);
    expect(prisma.tenant.create).toHaveBeenCalledTimes(1);
  });

  it('normalizes punctuation and whitespace when generating a slug', async () => {
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) =>
      fn(prisma),
    );
    prisma.tenant.create.mockResolvedValue(tenantRow);
    prisma.tenantAudit.create.mockResolvedValue({});
    prisma.tenantOutbox.create.mockResolvedValue({});

    await service.create({ name: '  Acme & Co.,  Ltd!!  ' });

    expect(prisma.tenant.create).toHaveBeenCalledWith({
      data: { name: '  Acme & Co.,  Ltd!!  ', slug: 'acme-co-ltd', settings: null },
    });
  });

  it('findOne requires matching tenancy context', async () => {
    prisma.tenant.findUnique.mockResolvedValue(tenantRow);

    await expect(service.findOne('t1')).rejects.toThrow(UnauthorizedException);

    await tenancy.run('other', async () => {
      await expect(service.findOne('t1')).rejects.toThrow(ForbiddenException);
    });

    await tenancy.run('t1', async () => {
      await expect(service.findOne('t1')).resolves.toEqual({
        ...tenantRow,
        settings: null,
      });
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
      expect(result.settings).toBeNull();
    });

    expect(prisma.tenantOutbox.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: 'tenant.updated' }),
      }),
    );
  });
});
