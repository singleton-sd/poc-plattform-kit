import type { UserManagerSettings } from 'oidc-client-ts';
import { UserManager, WebStorageStateStore } from 'oidc-client-ts';

export type OidcPublicConfig = {
  issuer: string;
  clientId: string;
  /** Access-token audience (API client id). Defaults to the SPA client id. */
  audience: string;
};

type EnvBag = NodeJS.ProcessEnv | Record<string, string | undefined>;

function envTrim(env: EnvBag, key: keyof EnvBag): string | undefined {
  const value = env[key]?.trim();
  return value || undefined;
}

/**
 * Read public Keycloak IDs for the SPA OIDC client.
 *
 * Runtime (no `env` arg) uses static `process.env.NEXT_PUBLIC_*` reads so Next
 * can inline them into the client bundle. Tests pass an explicit `env` bag.
 */
export function resolveOidcPublicConfig(env?: EnvBag): OidcPublicConfig | null {
  const issuer = (
    env ? envTrim(env, 'NEXT_PUBLIC_KEYCLOAK_ISSUER') : process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER
  )?.replace(/\/+$/, '');
  const clientId = env
    ? envTrim(env, 'NEXT_PUBLIC_KEYCLOAK_CLIENT_ID')
    : process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID?.trim();
  const audience = env
    ? envTrim(env, 'NEXT_PUBLIC_KEYCLOAK_API_AUDIENCE')
    : process.env.NEXT_PUBLIC_KEYCLOAK_API_AUDIENCE?.trim();

  if (!issuer || !clientId) {
    return null;
  }

  return {
    issuer,
    clientId,
    audience: audience || clientId,
  };
}

/** Build oidc-client-ts settings for the current SPA origin. */
export function buildOidcSettings(
  publicConfig: OidcPublicConfig,
  redirectUri: string,
): UserManagerSettings {
  const store =
    typeof window !== 'undefined'
      ? new WebStorageStateStore({ store: window.sessionStorage })
      : undefined;

  return {
    authority: publicConfig.issuer,
    client_id: publicConfig.clientId,
    redirect_uri: redirectUri,
    post_logout_redirect_uri: redirectUri,
    response_type: 'code',
    // Audience is a token mapper, not a client scope (Keycloak 26 invalid_scope).
    scope: 'openid profile email',
    automaticSilentRenew: true,
    loadUserInfo: false,
    ...(store ? { userStore: store } : {}),
  };
}

let manager: UserManager | null = null;

/** Singleton OIDC user manager for the SPA (browser only). */
export function getOidcUserManager(
  redirectUri: string = typeof window !== 'undefined' ? window.location.origin : '',
): UserManager {
  if (manager) {
    return manager;
  }

  const publicConfig = resolveOidcPublicConfig();
  if (!publicConfig) {
    throw new Error(
      'OIDC is not configured (set NEXT_PUBLIC_KEYCLOAK_ISSUER and NEXT_PUBLIC_KEYCLOAK_CLIENT_ID)',
    );
  }
  if (!redirectUri) {
    throw new Error('OIDC redirectUri is required');
  }

  manager = new UserManager(buildOidcSettings(publicConfig, redirectUri));
  return manager;
}

/** Test helper — clears the singleton between Jest cases. */
export function resetOidcUserManagerForTests(): void {
  manager = null;
}
