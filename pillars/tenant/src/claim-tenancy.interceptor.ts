import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenancyContext } from './tenancy.context';

/**
 * After auth guards attach `req.user`, prefer claim `tenantId` over any prior
 * `x-tenant-id` ALS value from TenancyMiddleware (Bearer path).
 */
@Injectable()
export class ClaimTenancyInterceptor implements NestInterceptor {
  constructor(private readonly tenancy: TenancyContext) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{
      user?: { tenantId?: string | null };
    }>();
    const claimTenant = req.user?.tenantId?.trim();
    if (!claimTenant) {
      return next.handle();
    }

    if (this.tenancy.getTenantId() === claimTenant) {
      return next.handle();
    }

    return new Observable((subscriber) => {
      this.tenancy.run(claimTenant, () => {
        next.handle().subscribe(subscriber);
      });
    });
  }
}
