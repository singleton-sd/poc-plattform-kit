type EnvBag = NodeJS.ProcessEnv | Record<string, string | undefined>;

function envTrim(env: EnvBag, key: string): string | undefined {
  const value = env[key]?.trim();
  return value || undefined;
}

/** Strip a trailing slash so JWKS / token paths join cleanly. */
export function normalizeKeycloakIssuer(issuer: string): string {
  return issuer.replace(/\/+$/, '');
}

export function resolveKeycloakIssuer(env: EnvBag = process.env): string | undefined {
  const issuer = envTrim(env, 'KEYCLOAK_ISSUER');
  return issuer ? normalizeKeycloakIssuer(issuer) : undefined;
}

export function keycloakJwksUri(issuer: string): string {
  return `${normalizeKeycloakIssuer(issuer)}/protocol/openid-connect/certs`;
}

export function keycloakAuthorizationUrl(issuer: string): string {
  return `${normalizeKeycloakIssuer(issuer)}/protocol/openid-connect/auth`;
}

export function keycloakTokenUrl(issuer: string): string {
  return `${normalizeKeycloakIssuer(issuer)}/protocol/openid-connect/token`;
}

export function resolveKeycloakClientId(env: EnvBag = process.env): string | undefined {
  return envTrim(env, 'KEYCLOAK_CLIENT_ID');
}

export function resolveKeycloakClientSecret(env: EnvBag = process.env): string | undefined {
  return envTrim(env, 'KEYCLOAK_CLIENT_SECRET');
}

/** API audience for access tokens. Defaults to the confidential client id. */
export function resolveKeycloakApiAudience(env: EnvBag = process.env): string | undefined {
  return envTrim(env, 'KEYCLOAK_API_AUDIENCE') ?? resolveKeycloakClientId(env);
}
