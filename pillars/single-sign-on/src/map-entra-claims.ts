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
  role: string | null;
  /** Local User.id when known; falls back to entraOid for claims-only sessions. */
  id: string;
  /** Platform tenant id from token/session when present. */
  tenantId: string | null;
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

  const roleFromArray =
    Array.isArray(claims.roles) && claims.roles.length > 0 ? claims.roles[0] : null;

  const tenantId =
    typeof claims.tenant_id === 'string' && claims.tenant_id.trim()
      ? claims.tenant_id.trim()
      : null;

  return {
    entraOid,
    email,
    name: claims.name ?? null,
    role: claims.role ?? roleFromArray,
    id: localUserId ?? entraOid,
    tenantId,
  };
}

/** Shape expected by the web `Me` client (`apps/web` fetchMe). */
export function toMeResponse(user: AuthenticatedUser): {
  id: string;
  email: string;
  name: string | null;
  role: string | null;
} {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}
