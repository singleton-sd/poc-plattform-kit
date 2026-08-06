import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { TenancyContext } from './tenancy.context';
import { TenancyMiddleware } from './tenancy.middleware';

describe('TenancyMiddleware', () => {
  let tenancy: TenancyContext;
  let middleware: TenancyMiddleware;

  beforeEach(() => {
    tenancy = new TenancyContext();
    middleware = new TenancyMiddleware(tenancy);
  });

  function run(req: {
    authUser?: { tenantId?: string | null };
    user?: { tenantId?: string | null };
    headers?: Record<string, string>;
  }): string | undefined {
    let resolved: string | undefined;
    const next: NextFunction = () => {
      resolved = tenancy.getTenantId();
    };
    const expressReq = {
      authUser: req.authUser,
      user: req.user,
      header: (name: string) => req.headers?.[name.toLowerCase()],
    };
    middleware.use(expressReq as unknown as Request, {} as Response, next);
    return resolved;
  }

  it('prefers authUser.tenantId over x-tenant-id', () => {
    expect(
      run({
        authUser: { tenantId: 'claim-tenant' },
        headers: { 'x-tenant-id': 'header-tenant' },
      }),
    ).toBe('claim-tenant');
  });

  it('falls back to x-tenant-id when claim is absent', () => {
    expect(run({ headers: { 'x-tenant-id': 'header-tenant' } })).toBe('header-tenant');
  });

  it('leaves tenancy unset when neither claim nor header is present', () => {
    expect(run({})).toBeUndefined();
  });
});
