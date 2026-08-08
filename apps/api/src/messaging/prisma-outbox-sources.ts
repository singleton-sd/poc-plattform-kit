import type { PrismaService } from '@poc-plattform-kit/db';
import type { PublishingPillarName } from '@poc-plattform-kit/events';
import type { OutboxRow, OutboxSource, OutboxStore } from './outbox-drainer.service';

interface OutboxDelegate {
  findMany(args: {
    where: {
      processedAt: null;
      failedAt: null;
      OR: Array<{ claimedAt: null } | { claimedAt: { lt: Date } }>;
    };
    orderBy: { createdAt: 'asc' };
    take: number;
    select: Record<keyof OutboxRow, true>;
  }): Promise<OutboxRow[]>;
  updateMany(args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }): Promise<{ count: number }>;
}

class PrismaOutboxStore implements OutboxStore {
  constructor(private readonly delegate: OutboxDelegate) {}

  async claimUnpublished(
    limit: number,
    claimId: string,
    claimedAt: Date,
    staleBefore: Date,
  ): Promise<OutboxRow[]> {
    const claimable = {
      processedAt: null,
      failedAt: null,
      OR: [{ claimedAt: null }, { claimedAt: { lt: staleBefore } }],
    };
    const candidates = await this.delegate.findMany({
      where: claimable,
      orderBy: { createdAt: 'asc' },
      take: limit,
      select: { id: true, eventType: true, payload: true, occurredAt: true },
    });
    const claimed: OutboxRow[] = [];
    for (const row of candidates) {
      const result = await this.delegate.updateMany({
        where: { id: row.id, ...claimable },
        data: { claimId, claimedAt },
      });
      if (result.count === 1) claimed.push(row);
    }
    return claimed;
  }

  async markPublished(id: string, claimId: string, publishedAt: Date): Promise<boolean> {
    const result = await this.delegate.updateMany({
      where: { id, claimId, processedAt: null },
      data: { processedAt: publishedAt, claimId: null, claimedAt: null },
    });
    return result.count === 1;
  }

  async markFailed(
    id: string,
    claimId: string,
    failedAt: Date,
    failureReason: string,
  ): Promise<boolean> {
    const result = await this.delegate.updateMany({
      where: { id, claimId, processedAt: null },
      data: { failedAt, failureReason, claimId: null, claimedAt: null },
    });
    return result.count === 1;
  }

  async releaseClaim(id: string, claimId: string): Promise<void> {
    await this.delegate.updateMany({
      where: { id, claimId, processedAt: null },
      data: { claimId: null, claimedAt: null },
    });
  }
}

export function createPrismaOutboxSources(prisma: PrismaService): OutboxSource[] {
  const delegates: Record<PublishingPillarName, OutboxDelegate> = {
    tenant: prisma.tenantOutbox,
    'single-sign-on': prisma.singleSignOnOutbox,
    permissions: prisma.permissionsOutbox,
    subscriptions: prisma.subscriptionsOutbox,
    contact: prisma.contactOutbox,
    notifications: prisma.notificationsOutbox,
  };

  return Object.entries(delegates).map(([pillar, delegate]) => ({
    pillar: pillar as PublishingPillarName,
    store: new PrismaOutboxStore(delegate),
  }));
}
