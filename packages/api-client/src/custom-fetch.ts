import { getApiClientConfig } from './client-config';

/**
 * Orval mutator (fetch + react-query): prefixes baseUrl, merges headers,
 * returns `{ data, status, headers }` matching Orval's fetch client shape.
 */
export async function customFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const { baseUrl, headers: defaultHeaders } = getApiClientConfig();
  const resolved = url.startsWith('http')
    ? url
    : `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;

  const response = await fetch(resolved, {
    ...options,
    headers: {
      ...(defaultHeaders ? Object.fromEntries(new Headers(defaultHeaders).entries()) : {}),
      ...(options?.headers ? Object.fromEntries(new Headers(options.headers).entries()) : {}),
    },
  });

  const contentType = response.headers.get('content-type') ?? '';
  let data: unknown = undefined;
  if (response.status !== 204) {
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }
  }

  return {
    data,
    status: response.status,
    headers: response.headers,
  } as T;
}
