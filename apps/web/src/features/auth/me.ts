import { useQuery } from '@tanstack/react-query';

export interface Me {
  id: string;
  email: string;
  name: string | null;
  /** Coarse AuthN role from SingleSignOn (e.g. 'tenant-admin', 'support-agent'). */
  role: string | null;
}

/**
 * Stub BFF client for the Auth.js `/api/me` endpoint. There's no real
 * SingleSignOn/Entra session to read yet, so this returns null (signed out)
 * for any non-2xx / non-JSON response instead of throwing -- callers should
 * treat a null Me as "not authenticated", not as an error.
 *
 * `/api/me` itself doesn't exist yet: this is a static SPA export (see
 * next.config.mjs), which can't run a dynamic Next.js Route Handler that
 * reads session cookies. Until SingleSignOn lands (API host / SWA-linked
 * backend), Azure SWA may SPA-fallback `/api/me` to `index.html` with 200 —
 * treat that HTML as signed-out instead of letting `res.json()` throw.
 */
export async function fetchMe(): Promise<Me | null> {
  const res = await fetch('/api/me', { credentials: 'include' });
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
