import type { AccountInfo, AuthenticationResult, SilentRequest } from '@azure/msal-browser';
import { InteractionRequiredAuthError } from '@azure/msal-browser';

import { getMsalPublicClient, resolveMsalPublicConfig } from './msal-config';

function loginRequestScopes(): string[] {
  const config = resolveMsalPublicConfig();
  if (!config) {
    throw new Error(
      'MSAL is not configured (set NEXT_PUBLIC_AZURE_AD_CLIENT_ID and NEXT_PUBLIC_AZURE_AD_TENANT_ID)',
    );
  }
  return [config.apiScope];
}

/** Prefer the active account from the last interactive login. */
function resolveAccount(app: Awaited<ReturnType<typeof getMsalPublicClient>>): AccountInfo | null {
  return app.getActiveAccount() ?? app.getAllAccounts()[0] ?? null;
}

let cachedAccessToken: string | null = null;
let cachedAccessTokenExpiresOn: number | null = null;

function cacheAccessToken(result: AuthenticationResult | null | undefined): void {
  if (!result?.accessToken) {
    return;
  }
  cachedAccessToken = result.accessToken;
  cachedAccessTokenExpiresOn = result.expiresOn ? result.expiresOn.getTime() : null;
}

function readCachedAccessToken(): string | null {
  if (!cachedAccessToken) {
    return null;
  }
  if (cachedAccessTokenExpiresOn && Date.now() >= cachedAccessTokenExpiresOn - 60_000) {
    cachedAccessToken = null;
    cachedAccessTokenExpiresOn = null;
    return null;
  }
  return cachedAccessToken;
}

/**
 * Complete an in-flight MSAL redirect and set the active account.
 * Safe to call on every cold load (no-op when there is no redirect response).
 */
export async function completeBearerRedirect(): Promise<boolean> {
  if (!resolveMsalPublicConfig()) {
    return false;
  }

  const app = await getMsalPublicClient();
  const result = await app.handleRedirectPromise();
  if (result?.account) {
    app.setActiveAccount(result.account);
    cacheAccessToken(result);
    return true;
  }

  if (!app.getActiveAccount()) {
    const existing = app.getAllAccounts()[0];
    if (existing) {
      app.setActiveAccount(existing);
    }
  }
  return false;
}

/**
 * Silent access-token acquire for Nest Bearer auth.
 * Returns null when signed out or MSAL is not configured (no interactive prompt).
 */
export async function getBearerAccessToken(): Promise<string | null> {
  if (!resolveMsalPublicConfig()) {
    return null;
  }

  const cached = readCachedAccessToken();
  if (cached) {
    return cached;
  }

  const app = await getMsalPublicClient();
  const account = resolveAccount(app);
  if (!account) {
    return null;
  }

  const request: SilentRequest = {
    account,
    scopes: loginRequestScopes(),
  };

  try {
    const result = await app.acquireTokenSilent(request);
    cacheAccessToken(result);
    return result.accessToken || null;
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      return null;
    }
    throw error;
  }
}

/**
 * Interactive MSAL redirect sign-in for SWA preview hosts.
 * Prefer redirect over popup — Entra sets COOP that blocks `window.closed` polling.
 */
export async function signInWithBearer(): Promise<void> {
  const app = await getMsalPublicClient();
  await app.loginRedirect({
    scopes: loginRequestScopes(),
  });
}

/** Clear MSAL session via redirect logout when an account exists. */
export async function signOutWithBearer(): Promise<void> {
  if (!resolveMsalPublicConfig()) {
    return;
  }

  cachedAccessToken = null;
  cachedAccessTokenExpiresOn = null;

  const app = await getMsalPublicClient();
  const account = resolveAccount(app);
  if (!account) {
    return;
  }

  app.setActiveAccount(null);
  await app.logoutRedirect({ account });
}

/** Test helper — clear in-memory access-token cache. */
export function resetBearerTokenCacheForTests(): void {
  cachedAccessToken = null;
  cachedAccessTokenExpiresOn = null;
}
