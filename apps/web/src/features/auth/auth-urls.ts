import { apiUrl } from '@/lib/api-base';

/** Auth.js Microsoft Entra ID provider id (`@auth/express/providers/microsoft-entra-id`). */
export const ENTRA_PROVIDER_ID = 'microsoft-entra-id';

/** Prefer the SPA origin so Auth.js redirects back to the web app, not the API host. */
export function defaultCallbackUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/`;
  }
  return '/';
}

/** Start Entra sign-in via Nest Auth.js on the API host. */
export function signInUrl(callbackUrl = defaultCallbackUrl()): string {
  const params = new URLSearchParams({ callbackUrl });
  return apiUrl(`/api/auth/signin/${ENTRA_PROVIDER_ID}?${params.toString()}`);
}

export function csrfUrl(): string {
  return apiUrl('/api/auth/csrf');
}

export function signOutUrl(): string {
  return apiUrl('/api/auth/signout');
}

/**
 * Sign out via Auth.js CSRF + POST.
 * Uses `NEXT_PUBLIC_API_BASE_URL` until SWA links `/api` → App Service.
 */
export async function signOut(callbackUrl = defaultCallbackUrl()): Promise<void> {
  const csrfRes = await fetch(csrfUrl(), { credentials: 'include' });
  if (!csrfRes.ok) {
    throw new Error('Failed to load Auth.js CSRF token');
  }

  const { csrfToken } = (await csrfRes.json()) as { csrfToken?: string };
  if (!csrfToken) {
    throw new Error('Auth.js CSRF response missing csrfToken');
  }

  const body = new URLSearchParams({
    csrfToken,
    callbackUrl,
  });

  const res = await fetch(signOutUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    credentials: 'include',
  });

  if (!res.ok) {
    throw new Error('Auth.js sign-out failed');
  }
}
