import { Global, Module } from '@nestjs/common';
import { PrismaService } from '@poc-plattform-kit/db';
import { OUTBOX_SOURCES, OutboxDrainerService } from './outbox-drainer.service';
import { createPrismaOutboxSources } from './prisma-outbox-sources';
import { ServiceBusClientService } from './service-bus-client.service';

@Global()
@Module({
  providers: [
    ServiceBusClientService,
    {
      provide: OUTBOX_SOURCES,
      inject: [PrismaService],
      useFactory: createPrismaOutboxSources,
    },
    OutboxDrainerService,
  ],
  exports: [ServiceBusClientService, OutboxDrainerService],
})
export class MessagingModule {}
