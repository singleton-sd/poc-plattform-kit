import type { ExpressAuthConfig } from '@auth/express';
import MicrosoftEntraID from '@auth/express/providers/microsoft-entra-id';

/** Pull platform identity fields from an Entra OIDC profile / token bag. */
export function extractEntraSessionFields(source: Record<string, unknown> | undefined): {
  oid?: string;
  sub?: string;
  roles?: string[];
  role?: string;
  tenant_id?: string;
} {
  if (!source) {
    return {};
  }

  const roles = Array.isArray(source.roles)
    ? source.roles.filter((r): r is string => typeof r === 'string')
    : undefined;

  return {
    oid: typeof source.oid === 'string' ? source.oid : undefined,
    sub: typeof source.sub === 'string' ? source.sub : undefined,
    roles,
    role: typeof source.role === 'string' ? source.role : undefined,
    tenant_id: typeof source.tenant_id === 'string' ? source.tenant_id : undefined,
  };
}

/** Cookie Domain for cross-subdomain Auth.js sessions (Option B; Free SWA). */
export function resolveAuthCookieDomain(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const domain = env.AUTH_COOKIE_DOMAIN?.trim();
  return domain || undefined;
}

export function buildAuthConfig(): ExpressAuthConfig | null {
  const secret = process.env.AUTH_SECRET?.trim();
  const clientId = process.env.AZURE_AD_CLIENT_ID?.trim();
  const clientSecret = process.env.AZURE_AD_CLIENT_SECRET?.trim();
  const tenantId = process.env.AZURE_AD_TENANT_ID?.trim();

  if (!secret || !clientId || !clientSecret || !tenantId) {
    return null;
  }

  const cookieDomain = resolveAuthCookieDomain();
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    secure: true,
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  };

  return {
    secret,
    trustHost: true,
    // Shared across app.* and api.* under the PoC parent domain (not SWA link).
    cookies: cookieDomain
      ? {
          sessionToken: { options: cookieOptions },
          callbackUrl: { options: cookieOptions },
          csrfToken: { options: { ...cookieOptions, httpOnly: false } },
        }
      : undefined,
    providers: [
      MicrosoftEntraID({
        clientId,
        clientSecret,
        issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
      }),
    ],
    callbacks: {
      async jwt({ token, profile }) {
        const fields = extractEntraSessionFields(profile as Record<string, unknown> | undefined);
        if (fields.oid) {
          token.oid = fields.oid;
        }
        if (fields.sub) {
          token.sub = fields.sub;
        }
        if (fields.roles) {
          token.roles = fields.roles;
        }
        if (fields.role) {
          token.role = fields.role;
        }
        if (fields.tenant_id) {
          token.tenant_id = fields.tenant_id;
        }
        return token;
      },
      async session({ session, token }) {
        const user = session.user as unknown as Record<string, unknown> | undefined;
        if (user) {
          const oid = typeof token.oid === 'string' ? token.oid : undefined;
          const sub = typeof token.sub === 'string' ? token.sub : undefined;
          if (oid) {
            user.oid = oid;
            user.id = oid;
          } else if (sub) {
            user.sub = sub;
            user.id = sub;
          }
          if (Array.isArray(token.roles)) {
            user.roles = token.roles.filter((r): r is string => typeof r === 'string');
          }
          if (typeof token.role === 'string') {
            user.role = token.role;
          }
          if (typeof token.tenant_id === 'string') {
            user.tenant_id = token.tenant_id;
          }
        }
        return session;
      },
    },
  };
}
