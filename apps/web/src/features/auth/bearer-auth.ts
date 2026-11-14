import { getOidcUserManager, resolveOidcPublicConfig } from './oidc-config';

let cachedAccessToken: string | null = null;
let cachedAccessTokenExpiresOn: number | null = null;

function cacheAccessToken(accessToken: string | undefined, expiresAt: number | undefined): void {
  if (!accessToken) {
    return;
  }
  cachedAccessToken = accessToken;
  cachedAccessTokenExpiresOn = typeof expiresAt === 'number' ? expiresAt * 1000 : null;
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
 * Complete an in-flight OIDC redirect and cache the access token.
 * Safe to call on every cold load (no-op when there is no callback).
 */
export async function completeBearerRedirect(): Promise<boolean> {
  if (!resolveOidcPublicConfig()) {
    return false;
  }

  const manager = getOidcUserManager();
  try {
    const user = await manager.signinRedirectCallback();
    if (user?.access_token) {
      cacheAccessToken(user.access_token, user.expires_at);
      return true;
    }
  } catch {
    // No callback params on this load — fall through to a stored user.
  }

  const existing = await readOrRenewUser(manager);
  if (existing?.access_token) {
    cacheAccessToken(existing.access_token, existing.expires_at);
  }
  return false;
}

/**
 * Silent access-token read for Nest Bearer auth.
 * Returns null when signed out or OIDC is not configured (no interactive prompt).
 */
export async function getBearerAccessToken(): Promise<string | null> {
  if (!resolveOidcPublicConfig()) {
    return null;
  }

  const cached = readCachedAccessToken();
  if (cached) {
    return cached;
  }

  const manager = getOidcUserManager();
  const user = await readOrRenewUser(manager);
  if (!user?.access_token) {
    return null;
  }

  cacheAccessToken(user.access_token, user.expires_at);
  return user.access_token;
}

type OidcUserLike = {
  access_token?: string;
  expires_at?: number;
  expired?: boolean;
};

type OidcManagerLike = {
  getUser: () => Promise<OidcUserLike | null>;
  signinSilent: () => Promise<OidcUserLike | null>;
};

async function readOrRenewUser(manager: OidcManagerLike): Promise<OidcUserLike | null> {
  const stored = await manager.getUser();
  if (stored?.access_token && !stored.expired) {
    return stored;
  }
  try {
    const renewed = await manager.signinSilent();
    if (renewed?.access_token && !renewed.expired) {
      return renewed;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Interactive OIDC redirect sign-in for SWA / ACA preview hosts.
 */
export async function signInWithBearer(): Promise<void> {
  const manager = getOidcUserManager();
  await manager.signinRedirect();
}

/** Clear the OIDC session via redirect logout when a user exists. */
export async function signOutWithBearer(): Promise<void> {
  if (!resolveOidcPublicConfig()) {
    return;
  }

  cachedAccessToken = null;
  cachedAccessTokenExpiresOn = null;

  const manager = getOidcUserManager();
  const user = await manager.getUser();
  if (!user) {
    return;
  }

  await manager.signoutRedirect();
}

/** Test helper — clear in-memory access-token cache. */
export function resetBearerTokenCacheForTests(): void {
  cachedAccessToken = null;
  cachedAccessTokenExpiresOn = null;
}
