import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { TenancyContext } from './tenancy.context';

/** Pre-SSO stub: resolve tenant id from `x-tenant-id`. SSO will augment with JWT claims. */
@Injectable()
export class TenancyMiddleware implements NestMiddleware {
  constructor(private readonly tenancy: TenancyContext) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    const header = req.header('x-tenant-id');
    const tenantId = header?.trim();
    if (tenantId) {
      this.tenancy.run(tenantId, () => next());
      return;
    }
    next();
  }
}
