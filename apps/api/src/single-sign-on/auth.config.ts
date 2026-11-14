import type { ExpressAuthConfig } from '@auth/express';
import Keycloak from '@auth/express/providers/keycloak';
import { isAuthRedirectOriginAllowed, parseCorsOrigins } from '../cors-origins';
import {
  resolveKeycloakClientId,
  resolveKeycloakClientSecret,
  resolveKeycloakIssuer,
} from './keycloak-issuer';

export type KeycloakSessionFields = {
  sub?: string;
  email?: string;
  preferred_username?: string;
  email_verified?: boolean;
  name?: string;
  roles?: string[];
  role?: string;
  tenant_id?: string;
  realm_access?: { roles?: string[] };
};

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const roles = value.filter((item): item is string => typeof item === 'string');
  return roles.length > 0 ? roles : undefined;
}

/** Pull platform identity fields from a Keycloak OIDC profile / token bag. */
export function extractKeycloakSessionFields(
  source: Record<string, unknown> | undefined,
): KeycloakSessionFields {
  if (!source) {
    return {};
  }

  const realmAccess =
    source.realm_access && typeof source.realm_access === 'object'
      ? (source.realm_access as { roles?: string[] })
      : undefined;

  const emailVerified =
    source.email_verified === true ||
    source.email_verified === 'true' ||
    source.emailVerified === true;

  return {
    sub: typeof source.sub === 'string' ? source.sub : undefined,
    email: typeof source.email === 'string' ? source.email : undefined,
    preferred_username:
      typeof source.preferred_username === 'string' ? source.preferred_username : undefined,
    email_verified: emailVerified || undefined,
    name: typeof source.name === 'string' ? source.name : undefined,
    roles: stringArray(source.roles),
    role: typeof source.role === 'string' ? source.role : undefined,
    tenant_id: typeof source.tenant_id === 'string' ? source.tenant_id : undefined,
    realm_access: realmAccess,
  };
}

/** Cookie Domain for cross-subdomain Auth.js sessions (Option B; Free SWA). */
export function resolveAuthCookieDomain(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const domain = env.AUTH_COOKIE_DOMAIN?.trim();
  return domain || undefined;
}

/** Allow Auth.js post-login redirects to known SPA origins (CORS allowlist). */
export function isAllowedAuthRedirect(url: string, baseUrl: string): boolean {
  if (url.startsWith('/')) {
    return true;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  let baseOrigin: string;
  try {
    baseOrigin = new URL(baseUrl).origin;
  } catch {
    return false;
  }

  if (parsed.origin === baseOrigin) {
    return true;
  }

  // Instance-scoped SWA prefixes only — never open *.azurestaticapps.net (open redirect).
  return isAuthRedirectOriginAllowed(parsed.origin, parseCorsOrigins(process.env.CORS_ORIGINS));
}

export function buildAuthConfig(): ExpressAuthConfig | null {
  const secret = process.env.AUTH_SECRET?.trim();
  const clientId = resolveKeycloakClientId();
  const clientSecret = resolveKeycloakClientSecret();
  const issuer = resolveKeycloakIssuer();

  if (!secret || !clientId || !clientSecret || !issuer) {
    return null;
  }

  const cookieDomain = resolveAuthCookieDomain();
  // Domain-scoped session/callback cookies only. Leave csrfToken host-only —
  // Auth.js defaults to `__Host-authjs.csrf-token`, and browsers reject
  // `__Host-` cookies that carry a Domain attribute.
  const domainCookieOptions = {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    secure: true,
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  };

  return {
    secret,
    trustHost: true,
    cookies: cookieDomain
      ? {
          sessionToken: { options: domainCookieOptions },
          callbackUrl: { options: domainCookieOptions },
        }
      : undefined,
    providers: [
      Keycloak({
        clientId,
        clientSecret,
        issuer,
      }),
    ],
    callbacks: {
      async redirect({ url, baseUrl }) {
        if (isAllowedAuthRedirect(url, baseUrl)) {
          return url.startsWith('/') ? `${baseUrl}${url}` : url;
        }
        return baseUrl;
      },
      async jwt({ token, profile }) {
        const fields = extractKeycloakSessionFields(profile as Record<string, unknown> | undefined);
        if (fields.sub) {
          token.sub = fields.sub;
        }
        if (fields.email) {
          token.email = fields.email;
        }
        if (fields.preferred_username) {
          token.preferred_username = fields.preferred_username;
        }
        if (fields.email_verified) {
          token.email_verified = true;
        }
        if (fields.name) {
          token.name = fields.name;
        }
        const realmRoles = stringArray(fields.realm_access?.roles);
        const mergedRoles = [...new Set([...(fields.roles ?? []), ...(realmRoles ?? [])])];
        if (mergedRoles.length > 0) {
          token.roles = mergedRoles;
        }
        if (fields.role) {
          token.role = fields.role;
        }
        if (fields.tenant_id) {
          token.tenant_id = fields.tenant_id;
        }
        if (fields.realm_access) {
          token.realm_access = fields.realm_access;
        }
        return token;
      },
      async session({ session, token }) {
        const user = session.user as unknown as Record<string, unknown> | undefined;
        if (user) {
          const sub = typeof token.sub === 'string' ? token.sub : undefined;
          if (sub) {
            user.sub = sub;
            user.id = sub;
          }
          if (typeof token.email === 'string') {
            user.email = token.email;
          }
          if (typeof token.preferred_username === 'string') {
            user.preferred_username = token.preferred_username;
          }
          if (token.email_verified === true) {
            user.email_verified = true;
          }
          if (typeof token.name === 'string') {
            user.name = token.name;
          }
          if (Array.isArray(token.roles)) {
            user.roles = token.roles.filter((role): role is string => typeof role === 'string');
          }
          if (typeof token.role === 'string') {
            user.role = token.role;
          }
          if (typeof token.tenant_id === 'string') {
            user.tenant_id = token.tenant_id;
          }
          if (token.realm_access && typeof token.realm_access === 'object') {
            user.realm_access = token.realm_access;
          }
        }
        return session;
      },
    },
  };
}
