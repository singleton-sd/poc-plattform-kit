import { UnauthorizedException } from '@nestjs/common';
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
  const create = jest.fn();
  const update = jest.fn();
  const updateMany = jest.fn();
  const findMany = jest.fn();
  const prisma = {
    user: { findUnique, create, update, updateMany, findMany },
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
  });

  it('backfills keycloakSub onto an existing user by verified email', async () => {
    updateMany.mockResolvedValue({ count: 1 });
    findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'local-legacy',
        entraOid: 'oid-legacy',
        keycloakSub: null,
        email: 'agent@example.com',
        name: 'Legacy',
      })
      .mockResolvedValueOnce({
        id: 'local-legacy',
        entraOid: 'oid-legacy',
        keycloakSub: 'kc-sub-1',
        email: 'agent@example.com',
        name: 'Agent',
      });

    const persisted = await service.persist(identity({ emailVerified: true }));

    expect(persisted).toMatchObject({
      id: 'local-legacy',
      keycloakSub: 'kc-sub-1',
      entraOid: 'oid-legacy',
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'local-legacy', keycloakSub: null },
      data: { keycloakSub: 'kc-sub-1', name: 'Agent' },
    });
    expect(create).not.toHaveBeenCalled();
  });

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
    findUnique.mockResolvedValue(null);
    create.mockResolvedValue({
      id: 'local-2',
      entraOid: null,
      keycloakSub: 'kc-sub-2',
      email: 'agent@example.com',
      name: 'Agent',
    });

    await service.persist(
      identity({ keycloakSub: 'kc-sub-2', id: 'kc-sub-2', emailVerified: false }),
    );

    expect(findUnique).toHaveBeenCalledTimes(1);
    expect(findUnique).toHaveBeenCalledWith({ where: { keycloakSub: 'kc-sub-2' } });
    expect(create).toHaveBeenCalled();
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
      Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
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
