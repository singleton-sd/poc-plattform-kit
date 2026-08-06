import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { TenancyContext } from './tenancy.context';

type TenancyRequest = Request & {
  authUser?: { tenantId?: string | null };
  user?: { tenantId?: string | null };
};

/**
 * Resolve request tenancy into AsyncLocalStorage.
 * Prefer session/JWT `tenantId` claims over `x-tenant-id` (legacy/dev escape).
 * Bearer JWT users may only gain claim tenancy after auth (see ClaimTenancyInterceptor).
 */
@Injectable()
export class TenancyMiddleware implements NestMiddleware {
  constructor(private readonly tenancy: TenancyContext) {}

  use(req: TenancyRequest, _res: Response, next: NextFunction): void {
    const claimTenant = req.authUser?.tenantId?.trim() || req.user?.tenantId?.trim() || undefined;
    const headerTenant = req.header('x-tenant-id')?.trim() || undefined;
    const tenantId = claimTenant ?? headerTenant;
    if (tenantId) {
      this.tenancy.run(tenantId, () => next());
      return;
    }
    next();
  }
}
