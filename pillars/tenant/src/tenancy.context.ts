import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable, UnauthorizedException } from '@nestjs/common';

export interface TenancyStore {
  tenantId: string;
}

/**
 * Request-scoped tenancy via AsyncLocalStorage.
 * Other pillars inject this service (DI) — never join Tenant tables cross-pillar.
 */
@Injectable()
export class TenancyContext {
  private readonly storage = new AsyncLocalStorage<TenancyStore>();

  run<T>(tenantId: string, fn: () => T): T {
    return this.storage.run({ tenantId }, fn);
  }

  getTenantId(): string | undefined {
    return this.storage.getStore()?.tenantId;
  }

  requireTenantId(): string {
    const tenantId = this.getTenantId();
    if (!tenantId) {
      throw new UnauthorizedException('Missing tenant context');
    }
    return tenantId;
  }
}
