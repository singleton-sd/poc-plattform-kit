import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import {
  ServiceBusClient,
  type ServiceBusReceiver,
  type ServiceBusSender,
} from '@azure/service-bus';
import {
  subscriptionForConsumer,
  topicForPillar,
  type DomainEventConsumerName,
  type PublishingPillarName,
} from '@poc-plattform-kit/events';

/**
 * Thin wrapper around `@azure/service-bus`, scoped to the platform host.
 * Pillars publish via their own transactional Outbox (see docs/db-practices.md);
 * this client is the stub the Outbox relay and subscription receivers will be
 * wired through once that ticket lands. Connects lazily and stays disabled
 * (rather than throwing at boot) when `AZURE_SERVICEBUS_CONNECTION_STRING`
 * isn't set, so local/dev API startup doesn't require live Azure resources.
 */
@Injectable()
export class ServiceBusClientService implements OnModuleDestroy {
  private readonly logger = new Logger(ServiceBusClientService.name);
  private readonly client: ServiceBusClient | undefined;

  constructor() {
    const connectionString = process.env.AZURE_SERVICEBUS_CONNECTION_STRING;
    if (connectionString) {
      this.client = new ServiceBusClient(connectionString);
    } else {
      this.logger.warn('AZURE_SERVICEBUS_CONNECTION_STRING not set — Service Bus client disabled');
    }
  }

  isEnabled(): boolean {
    return this.client !== undefined;
  }

  /** Sender for a publishing pillar's own `{pillar}.events` topic. */
  getSender(pillar: PublishingPillarName): ServiceBusSender {
    return this.requireClient().createSender(topicForPillar(pillar));
  }

  /** Receiver for a consumer's subscription on a publishing pillar's topic. */
  getReceiver(pillar: PublishingPillarName, consumer: DomainEventConsumerName): ServiceBusReceiver {
    return this.requireClient().createReceiver(
      topicForPillar(pillar),
      subscriptionForConsumer(consumer),
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.close();
  }

  private requireClient(): ServiceBusClient {
    if (!this.client) {
      throw new Error(
        'Service Bus client is not configured (AZURE_SERVICEBUS_CONNECTION_STRING missing)',
      );
    }
    return this.client;
  }
}
