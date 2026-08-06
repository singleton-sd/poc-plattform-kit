import { Module } from '@nestjs/common';
import { PrismaModule } from '@poc-plattform-kit/db';
import { TenantModule } from '@poc-plattform-kit/pillar-tenant';
import { LoggerModule } from 'nestjs-pino';
import { HealthModule } from './health/health.module';
import { SingleSignOnModule } from './single-sign-on/single-sign-on.module';

const usePrettyTransport =
  process.env.LOG_PRETTY === 'true' || process.env.NODE_ENV === 'development';

// Pillar modules (Tenant, SingleSignOn, Subscriptions, Contact, Support,
// Audit, Reporting) register here as their foundation tickets land.
@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport: usePrettyTransport
          ? { target: 'pino-pretty', options: { singleLine: true } }
          : undefined,
        customProps: (req) => ({
          correlationId:
            (req.headers['x-correlation-id'] as string | undefined) ??
            (req as { correlationId?: string }).correlationId,
          cloudRoleName: 'api',
        }),
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'APPLICATIONINSIGHTS_CONNECTION_STRING',
          ],
          remove: true,
        },
      },
    }),
    PrismaModule,
    HealthModule,
    TenantModule,
    SingleSignOnModule,
  ],
})
export class AppModule {}
