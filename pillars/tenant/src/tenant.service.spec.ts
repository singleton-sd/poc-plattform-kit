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
  const actorUserId = 'actor-1';

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
    tenantMembership: { create: jest.Mock; findMany: jest.Mock; count: jest.Mock };
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
      tenantMembership: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    };
    tenancy = new TenancyContext();
    service = new TenantService(prisma as never, tenancy);
  });

  it('lists tenants with a capped, deterministic query', async () => {
    prisma.tenant.findMany.mockResolvedValue([tenantRow]);

    await expect(service.findAll({})).resolves.toEqual({
      items: [{ ...tenantRow, settings: null }],
      nextCursor: null,
    });
    expect(prisma.tenant.findMany).toHaveBeenCalledWith({
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: 26,
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
      take: 11,
    });
  });

  it('caps results when called outside the validated HTTP boundary', async () => {
    prisma.tenant.findMany.mockResolvedValue([]);

    await service.findAll({ limit: 1_000 });

    expect(prisma.tenant.findMany).toHaveBeenCalledWith({
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: 101,
    });
  });

  it('returns a nextCursor and trims the extra probe row when another page follows', async () => {
    const rows = Array.from({ length: 3 }, (_, i) => ({
      ...tenantRow,
      id: `t${i + 1}`,
      name: `Tenant ${i + 1}`,
    }));
    prisma.tenant.findMany.mockResolvedValue(rows);

    const result = await service.findAll({ limit: 2 });

    expect(result.items).toHaveLength(2);
    expect(result.items.map((t) => t.id)).toEqual(['t1', 't2']);
    expect(result.nextCursor).toBe('t2');
    expect(prisma.tenant.findMany).toHaveBeenCalledWith({
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: 3,
    });
  });

  it('returns a null nextCursor when the page is not full', async () => {
    prisma.tenant.findMany.mockResolvedValue([tenantRow]);

    const result = await service.findAll({ limit: 25 });

    expect(result.nextCursor).toBeNull();
  });

  it('passes an opaque cursor through to Prisma cursor-based pagination', async () => {
    prisma.tenant.findMany.mockResolvedValue([]);

    await service.findAll({ cursor: 't1', limit: 25 });

    expect(prisma.tenant.findMany).toHaveBeenCalledWith({
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: 26,
      cursor: { id: 't1' },
      skip: 1,
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
    prisma.tenantMembership.create.mockResolvedValue({});

    const result = await service.create(
      {
        name: 'Acme',
        slug: 'acme',
        settings: { plan: 'pro' },
      },
      actorUserId,
    );

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

  it('auto-assigns the creator as owner via a membership row', async () => {
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) =>
      fn(prisma),
    );
    prisma.tenant.create.mockResolvedValue(tenantRow);
    prisma.tenantAudit.create.mockResolvedValue({});
    prisma.tenantOutbox.create.mockResolvedValue({});
    prisma.tenantMembership.create.mockResolvedValue({});

    await service.create({ name: 'Acme', slug: 'acme' }, actorUserId);

    expect(prisma.tenantMembership.create).toHaveBeenCalledWith({
      data: { tenantId: 't1', userId: actorUserId, role: 'owner' },
    });
  });

  it('emits tenant.member_added alongside tenant.created', async () => {
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) =>
      fn(prisma),
    );
    prisma.tenant.create.mockResolvedValue(tenantRow);
    prisma.tenantAudit.create.mockResolvedValue({});
    prisma.tenantOutbox.create.mockResolvedValue({});
    prisma.tenantMembership.create.mockResolvedValue({});

    await service.create({ name: 'Acme', slug: 'acme' }, actorUserId);

    expect(prisma.tenantOutbox.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: 'tenant.created',
        }),
      }),
    );
    const memberAddedCall = prisma.tenantOutbox.create.mock.calls.find(([call]) =>
      (call.data.payload as string).includes('tenant.member_added'),
    );
    expect(memberAddedCall).toBeDefined();
    const payload = JSON.parse(memberAddedCall![0].data.payload);
    expect(payload).toMatchObject({
      type: 'tenant.member_added',
      tenantId: 't1',
      payload: { userId: actorUserId, role: 'owner' },
    });
  });

  it('rolls back tenant creation when the membership insert fails', async () => {
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) =>
      fn(prisma),
    );
    prisma.tenant.create.mockResolvedValue(tenantRow);
    prisma.tenantAudit.create.mockResolvedValue({});
    prisma.tenantOutbox.create.mockResolvedValue({});
    prisma.tenantMembership.create.mockRejectedValue(new Error('membership insert failed'));

    await expect(service.create({ name: 'Acme', slug: 'acme' }, actorUserId)).rejects.toThrow(
      'membership insert failed',
    );
    // A real Prisma $transaction rolls the whole callback back on any
    // rejection; this asserts the service doesn't swallow that failure or
    // return a tenant that only appears to have been created.
  });

  it('generates a normalized slug from the name when slug is omitted', async () => {
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) =>
      fn(prisma),
    );
    prisma.tenant.create.mockResolvedValue({ ...tenantRow, name: 'Acme Pty Ltd' });
    prisma.tenantAudit.create.mockResolvedValue({});
    prisma.tenantOutbox.create.mockResolvedValue({});
    prisma.tenantMembership.create.mockResolvedValue({});

    await service.create({ name: 'Acme Pty Ltd' }, actorUserId);

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
    prisma.tenantMembership.create.mockResolvedValue({});

    await service.create({ name: 'Acme', slug: '   ' }, actorUserId);

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
    prisma.tenantMembership.create.mockResolvedValue({});

    const result = await service.create({ name: 'Acme' }, actorUserId);

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
    prisma.tenantMembership.create.mockResolvedValue({});

    await service.create({ name: '日本語' }, actorUserId);

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
    prisma.tenantMembership.create.mockResolvedValue({});

    await service.create({ name: 'Acme', slug: 'custom-slug' }, actorUserId);

    expect(prisma.tenant.create).toHaveBeenCalledTimes(1);
    expect(prisma.tenant.create).toHaveBeenCalledWith({
      data: { name: 'Acme', slug: 'custom-slug', settings: null },
    });
  });

  it('rejects an explicitly supplied slug with an invalid format', async () => {
    await expect(service.create({ name: 'Acme', slug: 'Not Valid!' }, actorUserId)).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.tenant.create).not.toHaveBeenCalled();
  });

  it('rejects a duplicate explicitly supplied slug without retrying', async () => {
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) =>
      fn(prisma),
    );
    prisma.tenant.create.mockRejectedValue(prismaKnownRequestError('P2002'));

    await expect(service.create({ name: 'Acme', slug: 'acme' }, actorUserId)).rejects.toThrow(
      ConflictException,
    );
    expect(prisma.tenant.create).toHaveBeenCalledTimes(1);
  });

  it('normalizes punctuation and whitespace when generating a slug', async () => {
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) =>
      fn(prisma),
    );
    prisma.tenant.create.mockResolvedValue(tenantRow);
    prisma.tenantAudit.create.mockResolvedValue({});
    prisma.tenantOutbox.create.mockResolvedValue({});
    prisma.tenantMembership.create.mockResolvedValue({});

    await service.create({ name: '  Acme & Co.,  Ltd!!  ' }, actorUserId);

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

  describe('listMemberships', () => {
    it('reads memberships for a tenant ordered by creation time', async () => {
      const rows = [
        { id: 'm1', tenantId: 't1', userId: 'u1', role: 'owner', createdAt: tenantRow.createdAt },
      ];
      prisma.tenantMembership.findMany.mockResolvedValue(rows);

      await expect(service.listMemberships('t1')).resolves.toEqual(rows);
      expect(prisma.tenantMembership.findMany).toHaveBeenCalledWith({
        where: { tenantId: 't1' },
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  describe('countOwnedTenants', () => {
    it('counts only owner-role memberships for the given user', async () => {
      prisma.tenantMembership.count.mockResolvedValue(2);

      await expect(service.countOwnedTenants('u1')).resolves.toBe(2);
      expect(prisma.tenantMembership.count).toHaveBeenCalledWith({
        where: { userId: 'u1', role: 'owner' },
      });
    });
  });
});
