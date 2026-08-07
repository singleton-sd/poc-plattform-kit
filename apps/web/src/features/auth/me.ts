import { useQuery } from '@tanstack/react-query';

import { apiUrl } from './api-base-url';
import { authHeaders } from './auth-urls';

export interface Me {
  id: string;
  email: string;
  name: string | null;
  /** Coarse AuthN role from SingleSignOn (e.g. 'tenant-admin', 'support-agent'). */
  role: string | null;
}

/**
 * Client for Nest SingleSignOn `GET /api/me`.
 *
 * - Custom domains: Auth.js httpOnly cookies (`credentials: 'include'`).
 * - SWA PR / Free hosts: MSAL Bearer token (`Authorization`) — cookies cannot
 *   share `AUTH_COOKIE_DOMAIN` with `*.azurestaticapps.net`.
 *
 * Returns null (signed out) for any non-2xx / non-JSON response — callers
 * should treat null as unauthenticated, not as an error.
 */
export async function fetchMe(): Promise<Me | null> {
  const res = await fetch(apiUrl('/api/me'), {
    credentials: 'include',
    headers: await authHeaders(),
  });
  if (!res.ok) return null;

  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return null;

  try {
    return (await res.json()) as Me;
  } catch {
    return null;
  }
}

export const meKeys = {
  all: ['me'] as const,
};

export function useMe() {
  return useQuery({
    queryKey: meKeys.all,
    queryFn: fetchMe,
    retry: false,
  });
}
