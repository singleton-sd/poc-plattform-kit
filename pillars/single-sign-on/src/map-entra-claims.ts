export interface EntraClaims {
  oid?: string;
  sub?: string;
  email?: string;
  preferred_username?: string;
  /** Common on access tokens when email is absent. */
  upn?: string;
  unique_name?: string;
  name?: string;
  roles?: string[];
  /** App roles sometimes appear as a single string. */
  role?: string;
  /**
   * Platform Kit tenant id (custom optional claim).
   * Not Entra directory `tid` — that is the Azure AD tenant, not a SaaS tenant row.
   */
  tenant_id?: string;
}

export interface AuthenticatedUser {
  entraOid: string;
  email: string;
  name: string | null;
  /** Coarse Entra app roles (e.g. tenant-admin, support-agent). */
  roles: string[];
  /** Local User.id when known; falls back to entraOid for claims-only sessions. */
  id: string;
  /** Platform tenant id from token/session when present. */
  tenantId: string | null;
}

/** Normalize Entra `roles[]` and optional singular `role` into a unique string list. */
export function normalizeEntraRoles(claims: Pick<EntraClaims, 'roles' | 'role'>): string[] {
  const fromArray = Array.isArray(claims.roles)
    ? claims.roles.filter((r): r is string => typeof r === 'string' && r.length > 0)
    : [];
  const fromSingular =
    typeof claims.role === 'string' && claims.role.length > 0 ? [claims.role] : [];

  return [...new Set([...fromArray, ...fromSingular])];
}

/**
 * Map Entra ID token / access-token claims into the platform identity shape.
 * Prefer `oid` (immutable object id); fall back to `sub`.
 */
export function mapEntraClaims(claims: EntraClaims, localUserId?: string): AuthenticatedUser {
  const entraOid = claims.oid ?? claims.sub;
  if (!entraOid) {
    throw new Error('Entra token missing oid/sub');
  }

  const email = claims.email ?? claims.preferred_username ?? claims.upn ?? claims.unique_name;
  if (!email) {
    throw new Error('Entra token missing email/preferred_username/upn');
  }

  const tenantId =
    typeof claims.tenant_id === 'string' && claims.tenant_id.trim()
      ? claims.tenant_id.trim()
      : null;

  return {
    entraOid,
    email,
    name: claims.name ?? null,
    roles: normalizeEntraRoles(claims),
    id: localUserId ?? entraOid,
    tenantId,
  };
}

/** Shape expected by the web `Me` client (`apps/web` fetchMe). */
export function toMeResponse(user: AuthenticatedUser): {
  id: string;
  email: string;
  name: string | null;
  roles: string[];
} {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    roles: user.roles,
  };
}
