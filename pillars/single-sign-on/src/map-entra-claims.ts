export interface EntraClaims {
  oid?: string;
  sub?: string;
  email?: string;
  preferred_username?: string;
  name?: string;
  roles?: string[];
  /** App roles sometimes appear as a single string. */
  role?: string;
}

export interface AuthenticatedUser {
  entraOid: string;
  email: string;
  name: string | null;
  role: string | null;
  /** Local User.id when known; falls back to entraOid for claims-only sessions. */
  id: string;
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

  const email = claims.email ?? claims.preferred_username;
  if (!email) {
    throw new Error('Entra token missing email/preferred_username');
  }

  const roleFromArray =
    Array.isArray(claims.roles) && claims.roles.length > 0 ? claims.roles[0] : null;

  return {
    entraOid,
    email,
    name: claims.name ?? null,
    role: claims.role ?? roleFromArray,
    id: localUserId ?? entraOid,
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
