import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ClaimTenancyInterceptor } from './claim-tenancy.interceptor';
import { TenancyContext } from './tenancy.context';
import { TenancyMiddleware } from './tenancy.middleware';
import { TenantController } from './tenant.controller';
import { TenantInvitationController } from './tenant-invitation.controller';
import { TenantInvitationService } from './tenant-invitation.service';
import { TenantService } from './tenant.service';

@Module({
  controllers: [TenantController, TenantInvitationController],
  providers: [
    TenancyContext,
    TenancyMiddleware,
    TenantService,
    TenantInvitationService,
    { provide: APP_INTERCEPTOR, useClass: ClaimTenancyInterceptor },
  ],
  exports: [TenancyContext, TenantService, TenantInvitationService],
})
export class TenantModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenancyMiddleware).forRoutes('*');
  }
}
