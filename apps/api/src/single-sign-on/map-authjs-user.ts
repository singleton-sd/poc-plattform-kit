import {
  mapKeycloakClaims,
  type AuthenticatedUser,
  type KeycloakClaims,
} from '@poc-plattform-kit/pillar-single-sign-on';

export function mapAuthJsUserToAuthenticatedUser(
  user: Record<string, unknown>,
): AuthenticatedUser | null {
  const claims: KeycloakClaims = {
    sub: typeof user.sub === 'string' ? user.sub : undefined,
    email: typeof user.email === 'string' ? user.email : undefined,
    preferred_username:
      typeof user.preferred_username === 'string' ? user.preferred_username : undefined,
    name: typeof user.name === 'string' ? user.name : undefined,
    email_verified:
      user.email_verified === true || user.email_verified === 'true' || user.emailVerified === true
        ? true
        : undefined,
    roles: Array.isArray(user.roles)
      ? user.roles.filter((role): role is string => typeof role === 'string')
      : undefined,
    role: typeof user.role === 'string' ? user.role : undefined,
    realm_access:
      user.realm_access && typeof user.realm_access === 'object'
        ? (user.realm_access as KeycloakClaims['realm_access'])
        : undefined,
    tenant_id: typeof user.tenant_id === 'string' ? user.tenant_id : undefined,
  };

  if (!claims.sub && typeof user.id === 'string') {
    claims.sub = user.id;
  }

  if (!claims.tenant_id && typeof user.tenantId === 'string') {
    claims.tenant_id = user.tenantId;
  }

  try {
    return mapKeycloakClaims(claims);
  } catch {
    return null;
  }
}
