import type { PrismaService } from '@poc-plattform-kit/db';
import { createPrismaOutboxSources } from './prisma-outbox-sources';

describe('createPrismaOutboxSources', () => {
  function delegate() {
    return {
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    };
  }

  function prisma() {
    return {
      tenantOutbox: delegate(),
      singleSignOnOutbox: delegate(),
      permissionsOutbox: delegate(),
      subscriptionsOutbox: delegate(),
      contactOutbox: delegate(),
      notificationsOutbox: delegate(),
    };
  }

  it('registers every publishing pillar', () => {
    const sources = createPrismaOutboxSources(prisma() as unknown as PrismaService);

    expect(sources.map(({ pillar }) => pillar)).toEqual([
      'tenant',
      'single-sign-on',
      'permissions',
      'subscriptions',
      'contact',
      'notifications',
    ]);
  });

  it('returns only rows won by the atomic conditional claim', async () => {
    const client = prisma();
    const rows = [
      {
        id: 'won',
        eventType: 'tenant.created',
        payload: '{}',
        occurredAt: new Date(),
      },
      {
        id: 'lost',
        eventType: 'tenant.created',
        payload: '{}',
        occurredAt: new Date(),
      },
    ];
    client.tenantOutbox.findMany.mockResolvedValue(rows);
    client.tenantOutbox.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    const tenant = createPrismaOutboxSources(client as unknown as PrismaService)[0];

    const claimed = await tenant!.store.claimUnpublished(50, 'claim-1', new Date(), new Date(0));

    expect(claimed).toEqual([rows[0]]);
    expect(client.tenantOutbox.updateMany).toHaveBeenCalledTimes(2);
  });
});
