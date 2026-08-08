import type { PrismaService } from '@poc-plattform-kit/db';
import type { PublishingPillarName } from '@poc-plattform-kit/events';
import type { OutboxRow, OutboxSource, OutboxStore } from './outbox-drainer.service';

interface OutboxDelegate {
  findMany(args: {
    where: { processedAt: null };
    orderBy: { createdAt: 'asc' };
    take: number;
    select: Record<keyof OutboxRow, true>;
  }): Promise<OutboxRow[]>;
  updateMany(args: {
    where: { id: string; processedAt: null };
    data: { processedAt: Date };
  }): Promise<{ count: number }>;
}

class PrismaOutboxStore implements OutboxStore {
  constructor(private readonly delegate: OutboxDelegate) {}

  findUnpublished(limit: number): Promise<OutboxRow[]> {
    return this.delegate.findMany({
      where: { processedAt: null },
      orderBy: { createdAt: 'asc' },
      take: limit,
      select: { id: true, eventType: true, payload: true, occurredAt: true },
    });
  }

  async markPublished(id: string, publishedAt: Date): Promise<boolean> {
    const result = await this.delegate.updateMany({
      where: { id, processedAt: null },
      data: { processedAt: publishedAt },
    });
    return result.count === 1;
  }
}

export function createPrismaOutboxSources(prisma: PrismaService): OutboxSource[] {
  const delegates: Array<[PublishingPillarName, OutboxDelegate]> = [
    ['tenant', prisma.tenantOutbox],
    ['single-sign-on', prisma.singleSignOnOutbox],
    ['subscriptions', prisma.subscriptionsOutbox],
    ['contact', prisma.contactOutbox],
  ];

  return delegates.map(([pillar, delegate]) => ({
    pillar,
    store: new PrismaOutboxStore(delegate),
  }));
}
