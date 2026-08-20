import {
  resolveTenantEmailProfileOverride,
  type TenantEmailProfileOverride,
} from '@poc-plattform-kit/email';

/** Alias for tenant `settings.email` sender fields (shared with `@poc-plattform-kit/email`). */
export type TenantEmailSettings = TenantEmailProfileOverride;

/**
 * Resolve tenant/PoC email sender overrides from `settings.email`.
 * Delegates to the shared parser in `@poc-plattform-kit/email`.
 */
export function resolveTenantEmailSettings(
  tenantSettings: Record<string, unknown> | null | undefined,
): TenantEmailSettings | null {
  return resolveTenantEmailProfileOverride(tenantSettings) ?? null;
}
