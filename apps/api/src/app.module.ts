import { Module } from '@nestjs/common';
import { PrismaModule } from '@poc-plattform-kit/db';
import { TenantModule } from '@poc-plattform-kit/pillar-tenant';
import { HealthModule } from './health/health.module';

@Module({
  imports: [PrismaModule, HealthModule, TenantModule],
})
export class AppModule {}
