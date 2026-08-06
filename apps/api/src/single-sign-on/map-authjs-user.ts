import {
  mapEntraClaims,
  type AuthenticatedUser,
  type EntraClaims,
} from '@poc-plattform-kit/pillar-single-sign-on';

export function mapAuthJsUserToAuthenticatedUser(
  user: Record<string, unknown>,
): AuthenticatedUser | null {
  const claims: EntraClaims = {
    oid: typeof user.oid === 'string' ? user.oid : undefined,
    sub: typeof user.sub === 'string' ? user.sub : undefined,
    email: typeof user.email === 'string' ? user.email : undefined,
    preferred_username:
      typeof user.preferred_username === 'string' ? user.preferred_username : undefined,
    name: typeof user.name === 'string' ? user.name : undefined,
    roles: Array.isArray(user.roles)
      ? user.roles.filter((r): r is string => typeof r === 'string')
      : undefined,
    role: typeof user.role === 'string' ? user.role : undefined,
    tenant_id: typeof user.tenant_id === 'string' ? user.tenant_id : undefined,
  };

  if (!claims.oid && !claims.sub && typeof user.id === 'string') {
    claims.sub = user.id;
  }

  if (!claims.tenant_id && typeof user.tenantId === 'string') {
    claims.tenant_id = user.tenantId;
  }

  try {
    return mapEntraClaims(claims);
  } catch {
    return null;
  }
}
