import { apiUrl } from './api-base-url';
import { resolveAuthMode } from './auth-mode';
import { getBearerAccessToken, signInWithBearer, signOutWithBearer } from './bearer-auth';

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

async function signInWithCookies(callbackUrl: string): Promise<void> {
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

async function signOutWithCookies(callbackUrl: string): Promise<void> {
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

/**
 * Start Entra sign-in.
 * Custom domains: Auth.js CSRF + form POST (cookies).
 * SWA / ACA preview hosts: MSAL redirect + Bearer access token.
 */
export async function signIn(callbackUrl = defaultCallbackUrl()): Promise<void> {
  if (resolveAuthMode() === 'bearer') {
    await signInWithBearer();
    return;
  }
  await signInWithCookies(callbackUrl);
}

/**
 * Sign out via Auth.js cookies or MSAL, depending on host.
 */
export async function signOut(callbackUrl = defaultCallbackUrl()): Promise<void> {
  if (resolveAuthMode() === 'bearer') {
    await signOutWithBearer();
    return;
  }
  await signOutWithCookies(callbackUrl);
}

/** Authorization header for Bearer mode (empty when cookie mode / signed out). */
export async function authHeaders(): Promise<HeadersInit> {
  if (resolveAuthMode() !== 'bearer') {
    return {};
  }
  const token = await getBearerAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
