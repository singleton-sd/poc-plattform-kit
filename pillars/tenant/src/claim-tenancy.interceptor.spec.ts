import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { ClaimTenancyInterceptor } from './claim-tenancy.interceptor';
import { TenancyContext } from './tenancy.context';

describe('ClaimTenancyInterceptor', () => {
  let tenancy: TenancyContext;
  let interceptor: ClaimTenancyInterceptor;

  beforeEach(() => {
    tenancy = new TenancyContext();
    interceptor = new ClaimTenancyInterceptor(tenancy);
  });

  it('overrides header tenancy with JWT/session claim tenantId', (done) => {
    tenancy.run('header-tenant', () => {
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { tenantId: 'claim-tenant' },
          }),
        }),
      } as ExecutionContext;

      const next: CallHandler = {
        handle: () => {
          expect(tenancy.getTenantId()).toBe('claim-tenant');
          return of({ ok: true });
        },
      };

      interceptor.intercept(context, next).subscribe({
        next: (value) => {
          expect(value).toEqual({ ok: true });
          done();
        },
        error: done,
      });
    });
  });

  it('passes through when user has no tenantId claim', (done) => {
    tenancy.run('header-tenant', () => {
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { tenantId: null },
          }),
        }),
      } as ExecutionContext;

      interceptor
        .intercept(context, {
          handle: () => {
            expect(tenancy.getTenantId()).toBe('header-tenant');
            return of(null);
          },
        })
        .subscribe({
          next: () => done(),
          error: done,
        });
    });
  });
});
