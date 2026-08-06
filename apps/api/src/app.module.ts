import { Module } from '@nestjs/common';
import { PrismaModule } from '@poc-plattform-kit/db';
import { TenantModule } from '@poc-plattform-kit/pillar-tenant';
import { HealthModule } from './health/health.module';
import { SingleSignOnModule } from './single-sign-on/single-sign-on.module';

@Module({
  imports: [PrismaModule, HealthModule, TenantModule, SingleSignOnModule],
})
export class AppModule {}
