import { UnauthorizedException } from '@nestjs/common';
import type { PrismaService } from '@poc-plattform-kit/db';
import { UserIdentityService } from './user-identity.service';

describe('UserIdentityService', () => {
  const upsert = jest.fn();
  const prisma = { user: { upsert } } as unknown as PrismaService;
  const service = new UserIdentityService(prisma);

  beforeEach(() => jest.resetAllMocks());

  it('creates a local user from an Entra identity', async () => {
    upsert.mockResolvedValue({
      id: 'local-1',
      entraOid: 'oid-1',
      email: 'agent@example.com',
      name: 'Agent',
    });

    await expect(
      service.persist({
        id: 'oid-1',
        entraOid: 'oid-1',
        email: 'agent@example.com',
        name: 'Agent',
        roles: ['tenant-admin'],
        tenantId: null,
      }),
    ).resolves.toEqual({
      id: 'local-1',
      entraOid: 'oid-1',
      email: 'agent@example.com',
      name: 'Agent',
      roles: ['tenant-admin'],
      tenantId: null,
    });
    expect(upsert).toHaveBeenCalledWith({
      where: { entraOid: 'oid-1' },
      create: { entraOid: 'oid-1', email: 'agent@example.com', name: 'Agent' },
      update: { email: 'agent@example.com', name: 'Agent' },
    });
  });

  it('refreshes email and name on a subsequent sign-in', async () => {
    upsert.mockResolvedValue({
      id: 'local-1',
      entraOid: 'oid-1',
      email: 'new@example.com',
      name: 'New name',
    });

    const persisted = await service.persist({
      id: 'oid-1',
      entraOid: 'oid-1',
      email: 'new@example.com',
      name: 'New name',
      roles: [],
      tenantId: 'tenant-1',
    });

    expect(persisted.id).toBe('local-1');
    expect(persisted.email).toBe('new@example.com');
    expect(persisted.name).toBe('New name');
    expect(persisted.tenantId).toBe('tenant-1');
  });

  it('is idempotent when the same identity signs in again', async () => {
    const row = {
      id: 'local-1',
      entraOid: 'oid-1',
      email: 'agent@example.com',
      name: null,
    };
    upsert.mockResolvedValue(row);
    const identity = {
      id: 'oid-1',
      entraOid: 'oid-1',
      email: 'agent@example.com',
      name: null,
      roles: [] as string[],
      tenantId: null,
    };

    await expect(service.persist(identity)).resolves.toMatchObject({ id: 'local-1' });
    await expect(service.persist(identity)).resolves.toMatchObject({ id: 'local-1' });
    expect(upsert).toHaveBeenCalledTimes(2);
  });

  it('rejects an identity without an email before writing', async () => {
    await expect(
      service.persist({
        id: 'oid-1',
        entraOid: 'oid-1',
        email: '',
        name: null,
        roles: [],
        tenantId: null,
      }),
    ).rejects.toThrow(UnauthorizedException);
    expect(upsert).not.toHaveBeenCalled();
  });
});
