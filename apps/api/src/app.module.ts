import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';

// Pillar modules (Tenant, SingleSignOn, Subscriptions, Contact, Support,
// Audit, Reporting) register here as their foundation tickets land.
@Module({
  imports: [HealthModule],
})
export class AppModule {}
