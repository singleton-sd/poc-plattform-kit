import { ConflictException, UnauthorizedException } from '@nestjs/common';
import type { PrismaService } from '@poc-plattform-kit/db';
import type { AuthenticatedUser } from './map-keycloak-claims';
import { UserIdentityService } from './user-identity.service';

function identity(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: 'kc-sub-1',
    keycloakSub: 'kc-sub-1',
    entraOid: null,
    email: 'agent@example.com',
    name: 'Agent',
    roles: ['tenant-admin'],
    tenantId: null,
    emailVerified: true,
    ...overrides,
  };
}

describe('UserIdentityService', () => {
  const findUnique = jest.fn();
  const findFirst = jest.fn();
  const create = jest.fn();
  const update = jest.fn();
  const updateMany = jest.fn();
  const findMany = jest.fn();
  const prisma = {
    user: { findUnique, findFirst, create, update, updateMany, findMany },
  } as unknown as PrismaService;
  const service = new UserIdentityService(prisma);

  beforeEach(() => jest.resetAllMocks());

  it('creates a local user from a new Keycloak identity', async () => {
    findUnique.mockResolvedValue(null);
    create.mockResolvedValue({
      id: 'local-1',
      entraOid: null,
      keycloakSub: 'kc-sub-1',
      email: 'agent@example.com',
      name: 'Agent',
    });

    await expect(service.persist(identity())).resolves.toEqual({
      id: 'local-1',
      keycloakSub: 'kc-sub-1',
      entraOid: null,
      email: 'agent@example.com',
      name: 'Agent',
      roles: ['tenant-admin'],
      tenantId: null,
      emailVerified: true,
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        keycloakSub: 'kc-sub-1',
        email: 'agent@example.com',
        name: 'Agent',
        entraOid: null,
      },
    });
  });

  it('refreshes email and name when keycloakSub already matches', async () => {
    findUnique.mockResolvedValueOnce({
      id: 'local-1',
      entraOid: 'oid-1',
      keycloakSub: 'kc-sub-1',
      email: 'old@example.com',
      name: 'Old',
    });
    update.mockResolvedValue({
      id: 'local-1',
      entraOid: 'oid-1',
      keycloakSub: 'kc-sub-1',
      email: 'new@example.com',
      name: 'New name',
    });

    const persisted = await service.persist(
      identity({ email: 'new@example.com', name: 'New name', tenantId: 'tenant-1' }),
    );

    expect(persisted.id).toBe('local-1');
    expect(persisted.email).toBe('new@example.com');
    expect(persisted.name).toBe('New name');
    expect(persisted.entraOid).toBe('oid-1');
    expect(persisted.tenantId).toBe('tenant-1');
    expect(create).not.toHaveBeenCalled();
    expect(findFirst).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({
      where: { id: 'local-1' },
      data: { email: 'new@example.com', name: 'New name' },
    });
  });

  it('does not overwrite stored email when the Keycloak email is unverified', async () => {
    findUnique.mockResolvedValueOnce({
      id: 'local-1',
      entraOid: 'oid-1',
      keycloakSub: 'kc-sub-1',
      email: 'Legacy@Example.com',
      name: 'Old',
    });
    update.mockResolvedValue({
      id: 'local-1',
      entraOid: 'oid-1',
      keycloakSub: 'kc-sub-1',
      email: 'Legacy@Example.com',
      name: 'New name',
    });

    const persisted = await service.persist(
      identity({ email: 'agent@example.com', name: 'New name', emailVerified: false }),
    );

    expect(persisted.email).toBe('Legacy@Example.com');
    expect(update).toHaveBeenCalledWith({
      where: { id: 'local-1' },
      data: { name: 'New name' },
    });
  });

  it('backfills keycloakSub onto an existing user by verified email', async () => {
    const unlinked = {
      id: 'local-legacy',
      entraOid: 'oid-legacy',
      keycloakSub: null,
      email: 'agent@example.com',
      name: 'Legacy',
    };
    const linked = {
      id: 'local-legacy',
      entraOid: 'oid-legacy',
      keycloakSub: 'kc-sub-1',
      email: 'agent@example.com',
      name: 'Agent',
    };
    updateMany.mockResolvedValue({ count: 1 });
    findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(unlinked)
      .mockResolvedValueOnce(linked);

    const persisted = await service.persist(identity({ emailVerified: true }));

    expect(persisted).toMatchObject({
      id: 'local-legacy',
      keycloakSub: 'kc-sub-1',
      entraOid: 'oid-legacy',
    });
    expect(findUnique).toHaveBeenCalledWith({ where: { email: 'agent@example.com' } });
    expect(findFirst).not.toHaveBeenCalled();
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'local-legacy', keycloakSub: null },
      data: { keycloakSub: 'kc-sub-1', name: 'Agent', email: 'agent@example.com' },
    });
    expect(create).not.toHaveBeenCalled();
  });

  it.each(['a_b@example.com', 'a%b@example.com'])(
    'does not match a different user when the email contains a wildcard (%s)',
    async (incomingEmail) => {
      const otherUser = {
        id: 'other-user',
        entraOid: 'oid-other',
        keycloakSub: null,
        email: 'axb@example.com',
        name: 'Other',
      };
      findUnique.mockImplementation(
        async (args: { where: { keycloakSub?: string; email?: string } }) => {
          if (args.where.keycloakSub) return null;
          if (args.where.email === incomingEmail) return null;
          if (args.where.email === otherUser.email) return otherUser;
          return null;
        },
      );
      findFirst.mockResolvedValue(otherUser);
      create.mockResolvedValue({
        id: 'literal-user',
        entraOid: null,
        keycloakSub: 'kc-sub-1',
        email: incomingEmail,
        name: 'Agent',
      });

      const persisted = await service.persist(
        identity({ email: incomingEmail, emailVerified: true }),
      );

      expect(persisted.id).toBe('literal-user');
      expect(findUnique).toHaveBeenCalledWith({ where: { email: incomingEmail } });
      expect(findFirst).not.toHaveBeenCalled();
      expect(updateMany).not.toHaveBeenCalled();
      expect(create).toHaveBeenCalledWith({
        data: {
          keycloakSub: 'kc-sub-1',
          email: incomingEmail,
          name: 'Agent',
          entraOid: null,
        },
      });
    },
  );

  it('does not replace an existing keycloakSub during email backfill', async () => {
    findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'local-other',
      entraOid: 'oid-other',
      keycloakSub: 'kc-sub-other',
      email: 'agent@example.com',
      name: 'Other',
    });

    await expect(service.persist(identity({ emailVerified: true }))).rejects.toThrow(
      UnauthorizedException,
    );
    expect(updateMany).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('does not steal an existing email when the Keycloak email is unverified', async () => {
    const existing = {
      id: 'local-legacy',
      entraOid: 'oid-legacy',
      keycloakSub: null,
      email: 'agent@example.com',
      name: 'Legacy',
    };
    findUnique.mockImplementation(
      async (args: { where: { keycloakSub?: string; email?: string } }) => {
        if (args.where.keycloakSub === 'kc-sub-2') return null;
        if (args.where.email === 'agent@example.com') return existing;
        return null;
      },
    );
    findFirst.mockResolvedValue(existing);
    create.mockResolvedValue({
      id: 'local-2',
      entraOid: null,
      keycloakSub: 'kc-sub-2',
      email: 'agent@example.com',
      name: 'Agent',
    });

    await expect(
      service.persist(identity({ keycloakSub: 'kc-sub-2', id: 'kc-sub-2', emailVerified: false })),
    ).rejects.toThrow(UnauthorizedException);

    expect(findUnique).toHaveBeenCalledTimes(1);
    expect(findUnique).toHaveBeenCalledWith({ where: { keycloakSub: 'kc-sub-2' } });
    expect(findFirst).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('lets a verified owner claim the email after an unverified login is rejected', async () => {
    findUnique.mockResolvedValue(null);
    create.mockResolvedValue({
      id: 'owner-1',
      entraOid: null,
      keycloakSub: 'kc-sub-owner',
      email: 'agent@example.com',
      name: 'Owner',
    });

    await expect(
      service.persist(identity({ keycloakSub: 'kc-sub-2', id: 'kc-sub-2', emailVerified: false })),
    ).rejects.toThrow(UnauthorizedException);
    expect(create).not.toHaveBeenCalled();

    const persisted = await service.persist(
      identity({ keycloakSub: 'kc-sub-owner', id: 'kc-sub-owner', emailVerified: true }),
    );

    expect(persisted.id).toBe('owner-1');
    expect(create).toHaveBeenCalledWith({
      data: {
        keycloakSub: 'kc-sub-owner',
        email: 'agent@example.com',
        name: 'Agent',
        entraOid: null,
      },
    });
  });

  it('rejects an identity without an email before writing', async () => {
    await expect(service.persist(identity({ email: '' }))).rejects.toThrow(UnauthorizedException);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('recovers a unique-constraint race on keycloakSub', async () => {
    findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'local-1',
      entraOid: null,
      keycloakSub: 'kc-sub-1',
      email: 'agent@example.com',
      name: 'Agent',
    });
    create.mockRejectedValue(
      Object.assign(new Error('Unique constraint failed'), {
        code: 'P2002',
        meta: { target: ['keycloakSub'] },
      }),
    );
    update.mockResolvedValue({
      id: 'local-1',
      entraOid: null,
      keycloakSub: 'kc-sub-1',
      email: 'agent@example.com',
      name: 'Agent',
    });

    await expect(service.persist(identity())).resolves.toMatchObject({ id: 'local-1' });
    expect(create).toHaveBeenCalled();
  });

  it('maps an email unique conflict on refresh to 409 instead of 500', async () => {
    findUnique.mockResolvedValueOnce({
      id: 'local-1',
      entraOid: 'oid-1',
      keycloakSub: 'kc-sub-1',
      email: 'old@example.com',
      name: 'Old',
    });
    update.mockRejectedValue(
      Object.assign(new Error('Unique constraint failed'), {
        code: 'P2002',
        meta: { target: ['email'] },
      }),
    );

    try {
      await service.persist(identity({ email: 'taken@example.com' }));
      throw new Error('expected persist to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getStatus()).toBe(409);
    }
  });

  it('maps an email unique conflict to 409 instead of 500', async () => {
    findUnique.mockResolvedValue(null);
    create.mockRejectedValue(
      Object.assign(new Error('Unique constraint failed'), {
        code: 'P2002',
        meta: { target: ['email'] },
      }),
    );

    try {
      await service.persist(identity());
      throw new Error('expected persist to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getStatus()).toBe(409);
    }
  });

  it('resolves durable user display records in deterministic id order', async () => {
    findMany.mockResolvedValue([
      { id: 'user-a', email: 'a@example.com', name: null },
      { id: 'user-b', email: 'b@example.com', name: 'Bee' },
    ]);

    await expect(service.findDisplayRecords(['user-b', 'user-a', 'user-b'])).resolves.toEqual([
      { id: 'user-a', email: 'a@example.com', name: null },
      { id: 'user-b', email: 'b@example.com', name: 'Bee' },
    ]);
    expect(findMany).toHaveBeenCalledWith({
      where: { id: { in: ['user-a', 'user-b'] } },
      select: { id: true, email: true, name: true },
      orderBy: { id: 'asc' },
    });
  });

  it('does not query when no durable user ids are requested', async () => {
    await expect(service.findDisplayRecords([])).resolves.toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });
});
