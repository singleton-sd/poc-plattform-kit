export type ApiClientConfig = {
  baseUrl: string;
  /** Extra headers merged into every request (e.g. x-tenant-id). */
  headers?: HeadersInit;
};

let config: ApiClientConfig = {
  baseUrl: '',
};

export function createApiClient(next: ApiClientConfig): void {
  config = {
    baseUrl: next.baseUrl.replace(/\/$/, ''),
    headers: next.headers,
  };
}

export function getApiClientConfig(): ApiClientConfig {
  return config;
}
