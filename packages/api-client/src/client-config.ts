export type ApiClientConfig = {
  baseUrl: string;
  /** Extra headers merged into every request (e.g. x-tenant-id). */
  headers?: HeadersInit;
  /** Fetch credentials; defaults to `include` for Auth.js session cookies. */
  credentials?: RequestCredentials;
};

const TENANT_HEADER = 'x-tenant-id';

let config: ApiClientConfig = {
  baseUrl: '',
  credentials: 'include',
};

export function createApiClient(next: ApiClientConfig): void {
  config = {
    baseUrl: next.baseUrl.replace(/\/$/, ''),
    headers: next.headers,
    credentials: next.credentials ?? 'include',
  };
}

/** Set or clear the `x-tenant-id` header without wiping baseUrl / other headers. */
export function setApiClientTenantId(tenantId: string | null | undefined): void {
  const headers = new Headers(config.headers);
  const trimmed = tenantId?.trim();
  if (trimmed) {
    headers.set(TENANT_HEADER, trimmed);
  } else {
    headers.delete(TENANT_HEADER);
  }
  config = {
    ...config,
    headers,
  };
}

export function getApiClientConfig(): ApiClientConfig {
  return config;
}
