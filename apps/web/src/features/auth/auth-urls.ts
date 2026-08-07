import { apiUrl } from './api-base-url';

/** Auth.js Microsoft Entra ID provider id (`@auth/express/providers/microsoft-entra-id`). */
export const ENTRA_PROVIDER_ID = 'microsoft-entra-id';

/** Prefer the SPA origin so Auth.js redirects back to the web app, not the API host. */
export function defaultCallbackUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/`;
  }
  return '/';
}

/** Nest Auth.js provider sign-in endpoint (POST + CSRF only — GET is unsupported). */
export function signInUrl(): string {
  return apiUrl(`/api/auth/signin/${ENTRA_PROVIDER_ID}`);
}

export function csrfUrl(): string {
  return apiUrl('/api/auth/csrf');
}

export function signOutUrl(): string {
  return apiUrl('/api/auth/signout');
}

async function fetchCsrfToken(): Promise<string> {
  const csrfRes = await fetch(csrfUrl(), { credentials: 'include' });
  if (!csrfRes.ok) {
    throw new Error('Failed to load Auth.js CSRF token');
  }

  const { csrfToken } = (await csrfRes.json()) as { csrfToken?: string };
  if (!csrfToken) {
    throw new Error('Auth.js CSRF response missing csrfToken');
  }
  return csrfToken;
}

/**
 * Start Entra sign-in via Auth.js CSRF + POST.
 * Submits a form so the browser follows the OAuth redirect (fetch cannot).
 */
export async function signIn(callbackUrl = defaultCallbackUrl()): Promise<void> {
  const csrfToken = await fetchCsrfToken();

  const form = document.createElement('form');
  form.method = 'POST';
  form.action = signInUrl();
  form.style.display = 'none';

  for (const [name, value] of Object.entries({ csrfToken, callbackUrl })) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }

  document.body.appendChild(form);
  form.submit();
}

/**
 * Sign out via Auth.js CSRF + POST.
 * Uses `NEXT_PUBLIC_API_BASE_URL` (Option B cross-subdomain cookies).
 */
export async function signOut(callbackUrl = defaultCallbackUrl()): Promise<void> {
  const csrfToken = await fetchCsrfToken();

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
