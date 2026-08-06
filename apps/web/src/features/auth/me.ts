import { useQuery } from '@tanstack/react-query';
import { apiUrl } from '@/lib/api-base';

export interface Me {
  id: string;
  email: string;
  name: string | null;
  /** Coarse AuthN role from SingleSignOn (e.g. 'tenant-admin', 'support-agent'). */
  role: string | null;
}

/**
 * BFF client for Nest SingleSignOn `GET /api/me`.
 *
 * Auth.js runs on the Nest API host (`/api/auth/*`) with httpOnly session
 * cookies. The SPA calls `NEXT_PUBLIC_API_BASE_URL` + `/api/me` with
 * `credentials: 'include'` (same-origin path when the env is unset / SWA-linked).
 *
 * Returns null (signed out) for any non-2xx / non-JSON response — callers
 * should treat null as unauthenticated, not as an error.
 *
 * Until SWA links `/api/*` to App Service (see **Link SWA /api to App
 * Service for SSO cookies**), Azure SWA may SPA-fallback same-origin
 * `/api/me` to `index.html` with 200 — non-JSON responses are treated as
 * signed-out.
 */
export async function fetchMe(): Promise<Me | null> {
  const res = await fetch(apiUrl('/api/me'), { credentials: 'include' });
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
