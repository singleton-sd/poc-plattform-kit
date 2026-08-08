import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import type { ServiceBusMessage } from '@azure/service-bus';
import type { PublishingPillarName } from '@poc-plattform-kit/events';
import { ServiceBusClientService } from './service-bus-client.service';

export interface OutboxRow {
  id: string;
  eventType: string;
  payload: string;
  occurredAt: Date;
}

export interface OutboxStore {
  findUnpublished(limit: number): Promise<OutboxRow[]>;
  markPublished(id: string, publishedAt: Date): Promise<boolean>;
}

export interface OutboxSource {
  pillar: PublishingPillarName;
  store: OutboxStore;
}

export const OUTBOX_SOURCES = Symbol('OUTBOX_SOURCES');
const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_INTERVAL_MS = 5_000;

@Injectable()
export class OutboxDrainerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxDrainerService.name);
  private inFlight: Promise<{ published: number }> | undefined;
  private timer: NodeJS.Timeout | undefined;

  constructor(
    @Inject(ServiceBusClientService)
    private readonly serviceBus: Pick<ServiceBusClientService, 'isEnabled' | 'getSender'>,
    @Inject(OUTBOX_SOURCES) private readonly sources: readonly OutboxSource[],
  ) {}

  onModuleInit(): void {
    if (!this.serviceBus.isEnabled()) return;

    void this.runScheduledDrain();
    this.timer = setInterval(
      () => void this.runScheduledDrain(),
      this.positiveInteger(process.env.OUTBOX_DRAIN_INTERVAL_MS, DEFAULT_INTERVAL_MS),
    );
    this.timer.unref();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.inFlight;
  }

  drainOnce(): Promise<{ published: number }> {
    if (!this.serviceBus.isEnabled()) return Promise.resolve({ published: 0 });
    if (this.inFlight) return this.inFlight;

    this.inFlight = this.drainSources().finally(() => {
      this.inFlight = undefined;
    });
    return this.inFlight;
  }

  private async drainSources(): Promise<{ published: number }> {
    let published = 0;
    const limit = this.positiveInteger(process.env.OUTBOX_DRAIN_BATCH_SIZE, DEFAULT_BATCH_SIZE);

    for (const { pillar, store } of this.sources) {
      const rows = await store.findUnpublished(limit);
      if (rows.length === 0) continue;

      const sender = this.serviceBus.getSender(pillar);
      try {
        for (const row of rows) {
          await sender.sendMessages(this.toMessage(row, pillar));
          if (await store.markPublished(row.id, new Date())) published += 1;
        }
      } finally {
        await sender.close();
      }
    }

    return { published };
  }

  private toMessage(row: OutboxRow, pillar: PublishingPillarName): ServiceBusMessage {
    return {
      body: JSON.parse(row.payload) as unknown,
      contentType: 'application/json',
      messageId: row.id,
      subject: row.eventType,
      applicationProperties: {
        occurredAt: row.occurredAt.toISOString(),
        pillar,
      },
    };
  }

  private async runScheduledDrain(): Promise<void> {
    try {
      const { published } = await this.drainOnce();
      if (published > 0) this.logger.log(`Published ${published} outbox event(s)`);
    } catch (error) {
      this.logger.error('Outbox drain failed; unpublished rows will be retried', error);
    }
  }

  private positiveInteger(value: string | undefined, fallback: number): number {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  }
}
