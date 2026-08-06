/** Auth.js Microsoft Entra ID provider id (`@auth/express/providers/microsoft-entra-id`). */
export const ENTRA_PROVIDER_ID = 'microsoft-entra-id';

/** Start Entra sign-in via Nest Auth.js (`/api/auth/*`). */
export function signInUrl(callbackUrl = '/'): string {
  const params = new URLSearchParams({ callbackUrl });
  return `/api/auth/signin/${ENTRA_PROVIDER_ID}?${params.toString()}`;
}

/** Auth.js sign-out endpoint (POST + CSRF). */
export const SIGN_OUT_URL = '/api/auth/signout';

export const CSRF_URL = '/api/auth/csrf';

/**
 * Sign out via Auth.js CSRF + POST. Relies on same-origin cookies
 * (SWA `/api` → App Service — see SSO cookie ticket).
 */
export async function signOut(callbackUrl = '/'): Promise<void> {
  const csrfRes = await fetch(CSRF_URL, { credentials: 'include' });
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

  const res = await fetch(SIGN_OUT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    credentials: 'include',
  });

  if (!res.ok) {
    throw new Error('Auth.js sign-out failed');
  }
}
