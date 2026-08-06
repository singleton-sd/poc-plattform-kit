import { UnauthorizedException } from '@nestjs/common';
import { TenancyContext } from './tenancy.context';

describe('TenancyContext', () => {
  let context: TenancyContext;

  beforeEach(() => {
    context = new TenancyContext();
  });

  it('resolves tenant id inside run()', () => {
    let resolved: string | undefined;
    context.run('tenant-a', () => {
      resolved = context.getTenantId();
    });
    expect(resolved).toBe('tenant-a');
  });

  it('returns undefined outside run()', () => {
    expect(context.getTenantId()).toBeUndefined();
  });

  it('requireTenantId throws when missing', () => {
    expect(() => context.requireTenantId()).toThrow(UnauthorizedException);
  });

  it('requireTenantId returns id when present', () => {
    context.run('tenant-b', () => {
      expect(context.requireTenantId()).toBe('tenant-b');
    });
  });
});
