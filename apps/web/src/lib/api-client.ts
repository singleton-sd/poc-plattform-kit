import { createApiClient, setApiClientTenantId } from '@poc-plattform-kit/api-client';

import { resolveAuthMode } from '@/features/auth/auth-mode';
import { getBearerAccessToken } from '@/features/auth/bearer-auth';

export type ConfigureApiClientOptions = {
  /** When set, sent as `x-tenant-id` on every generated-client request. */
  tenantId?: string | null;
};

/**
 * Configures the shared Orval/fetch client for this SPA.
 * Call once at app startup and again whenever the active tenant changes.
 *
 * On SWA and ACA preview hosts, attaches a per-request MSAL Bearer token
 * provider so Nest JWT auth works without cross-site Auth.js cookies.
 */
export function configureApiClient(options: ConfigureApiClientOptions = {}): void {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
  createApiClient({
    baseUrl,
    getAccessToken: async () => {
      if (resolveAuthMode() !== 'bearer') {
        return null;
      }
      return getBearerAccessToken();
    },
  });
  const tenantId = options.tenantId?.trim();
  setApiClientTenantId(tenantId || null);
}
