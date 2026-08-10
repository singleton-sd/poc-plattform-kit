import { Module } from '@nestjs/common';
import { PrismaModule } from '@poc-plattform-kit/db';
import { HealthController } from './health.controller';

@Module({
  imports: [PrismaModule],
  controllers: [HealthController],
})
export class HealthModule {}
