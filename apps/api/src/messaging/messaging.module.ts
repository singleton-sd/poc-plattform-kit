import { Global, Module } from '@nestjs/common';
import { ServiceBusClientService } from './service-bus-client.service';

@Global()
@Module({
  providers: [ServiceBusClientService],
  exports: [ServiceBusClientService],
})
export class MessagingModule {}
