export interface KeycloakRealmAccess {
  roles?: string[];
}

export interface KeycloakResourceAccess {
  [clientId: string]: { roles?: string[] } | undefined;
}

export interface KeycloakClaims {
  sub?: string;
  email?: string;
  preferred_username?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  email_verified?: boolean | string;
  roles?: string[];
  role?: string;
  realm_access?: KeycloakRealmAccess;
  resource_access?: KeycloakResourceAccess;
  /**
   * Platform Kit tenant id (custom optional claim).
   * Not a Keycloak realm id.
   */
  tenant_id?: string;
}

export interface AuthenticatedUser {
  keycloakSub: string;
  /** Leftover Entra object id during Keycloak backfill; null for new users. */
  entraOid: string | null;
  email: string;
  name: string | null;
  /** Coarse app roles (e.g. tenant-admin, support-agent) from the token. */
  roles: string[];
  /** Local User.id when known; falls back to keycloakSub for claims-only sessions. */
  id: string;
  /** Platform tenant id from token/session when present. */
  tenantId: string | null;
  /** True when the IdP asserted a verified email (required to backfill). */
  emailVerified: boolean;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function displayName(claims: KeycloakClaims): string | null {
  if (isNonEmptyString(claims.name)) {
    return claims.name;
  }
  const parts = [claims.given_name, claims.family_name].filter(isNonEmptyString);
  return parts.length > 0 ? parts.join(' ') : null;
}

function rolesFromRealm(claims: KeycloakClaims): string[] {
  const realmRoles = claims.realm_access?.roles;
  if (!Array.isArray(realmRoles)) {
    return [];
  }
  return realmRoles.filter(isNonEmptyString);
}

function rolesFromResourceAccess(claims: KeycloakClaims, platformClientIds: string[]): string[] {
  const resourceAccess = claims.resource_access;
  if (!resourceAccess || typeof resourceAccess !== 'object' || platformClientIds.length === 0) {
    return [];
  }
  const collected: string[] = [];
  for (const clientId of platformClientIds) {
    const roles = resourceAccess[clientId]?.roles;
    if (!Array.isArray(roles)) {
      continue;
    }
    collected.push(...roles.filter(isNonEmptyString));
  }
  return collected;
}

/** Client ids whose `resource_access` roles count as platform coarse roles. */
export function resolvePlatformRoleClientIds(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): string[] {
  const ids = [
    env.KEYCLOAK_API_AUDIENCE,
    env.KEYCLOAK_CLIENT_ID,
    env.NEXT_PUBLIC_KEYCLOAK_API_AUDIENCE,
    env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID,
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  return [...new Set(ids)];
}

/** Normalize Keycloak realm/client roles and optional singular `role`. */
export function normalizeKeycloakRoles(
  claims: KeycloakClaims,
  platformClientIds: string[] = resolvePlatformRoleClientIds(),
): string[] {
  const fromArray = Array.isArray(claims.roles) ? claims.roles.filter(isNonEmptyString) : [];
  const fromSingular = isNonEmptyString(claims.role) ? [claims.role] : [];
  return [
    ...new Set([
      ...fromArray,
      ...fromSingular,
      ...rolesFromRealm(claims),
      ...rolesFromResourceAccess(claims, platformClientIds),
    ]),
  ];
}

export function isEmailVerifiedClaim(value: unknown): boolean {
  return value === true || value === 'true';
}

/**
 * Map Keycloak ID / access-token claims into the platform identity shape.
 * Durable key is `sub`.
 */
export function mapKeycloakClaims(claims: KeycloakClaims, localUserId?: string): AuthenticatedUser {
  const keycloakSub = claims.sub;
  if (!isNonEmptyString(keycloakSub)) {
    throw new Error('Keycloak token missing sub');
  }

  const email = claims.email ?? claims.preferred_username;
  if (!isNonEmptyString(email)) {
    throw new Error('Keycloak token missing email/preferred_username');
  }

  const tenantId =
    typeof claims.tenant_id === 'string' && claims.tenant_id.trim()
      ? claims.tenant_id.trim()
      : null;

  return {
    keycloakSub,
    entraOid: null,
    email,
    name: displayName(claims),
    roles: normalizeKeycloakRoles(claims),
    id: localUserId ?? keycloakSub,
    tenantId,
    emailVerified: isEmailVerifiedClaim(claims.email_verified),
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
