import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TenancyContext } from './tenancy.context';
import { TenancyMiddleware } from './tenancy.middleware';
import { TenantController } from './tenant.controller';
import { TenantService } from './tenant.service';

@Module({
  controllers: [TenantController],
  providers: [TenancyContext, TenancyMiddleware, TenantService],
  exports: [TenancyContext, TenantService],
})
export class TenantModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenancyMiddleware).forRoutes('*');
  }
}
