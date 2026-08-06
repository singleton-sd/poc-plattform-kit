import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ClaimTenancyInterceptor } from './claim-tenancy.interceptor';
import { TenancyContext } from './tenancy.context';
import { TenancyMiddleware } from './tenancy.middleware';
import { TenantController } from './tenant.controller';
import { TenantService } from './tenant.service';

@Module({
  controllers: [TenantController],
  providers: [
    TenancyContext,
    TenancyMiddleware,
    TenantService,
    { provide: APP_INTERCEPTOR, useClass: ClaimTenancyInterceptor },
  ],
  exports: [TenancyContext, TenantService],
})
export class TenantModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenancyMiddleware).forRoutes('*');
  }
}
