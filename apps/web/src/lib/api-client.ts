import { createApiClient, setApiClientTenantId } from '@poc-plattform-kit/api-client';

export type ConfigureApiClientOptions = {
  /** When set, sent as `x-tenant-id` on every generated-client request. */
  tenantId?: string | null;
};

/**
 * Configures the shared Orval/fetch client for this SPA.
 * Call once at app startup and again whenever the active tenant changes.
 */
export function configureApiClient(options: ConfigureApiClientOptions = {}): void {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
  createApiClient({ baseUrl });
  const tenantId = options.tenantId?.trim();
  setApiClientTenantId(tenantId || null);
}
