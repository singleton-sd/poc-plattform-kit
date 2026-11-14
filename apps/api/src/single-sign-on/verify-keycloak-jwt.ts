import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey, type KeyLike } from 'jose';
import {
  keycloakJwksUri,
  resolveKeycloakApiAudience,
  resolveKeycloakIssuer,
} from './keycloak-issuer';

export type KeycloakJwtVerifyOptions = {
  issuer: string;
  audience: string;
  jwks: JWTVerifyGetKey;
};

/**
 * Build issuer + audience + JWKS for Keycloak access tokens.
 * Returns null when env is incomplete so Nest can still boot locally.
 */
export function buildKeycloakJwtVerifyOptions(
  env: NodeJS.ProcessEnv = process.env,
  jwksFactory: (jwksUri: string) => JWTVerifyGetKey = createRemoteJWKSetFromUri,
): KeycloakJwtVerifyOptions | null {
  const issuer = resolveKeycloakIssuer(env);
  const audience = resolveKeycloakApiAudience(env);
  if (!issuer || !audience) {
    return null;
  }

  return {
    issuer,
    audience,
    jwks: jwksFactory(keycloakJwksUri(issuer)),
  };
}

export function createRemoteJWKSetFromUri(jwksUri: string): JWTVerifyGetKey {
  return createRemoteJWKSet(new URL(jwksUri));
}

/**
 * Verify a Keycloak access token: signature (JWKS), issuer, audience, expiry.
 */
export async function verifyKeycloakAccessToken(
  token: string,
  options: KeycloakJwtVerifyOptions,
): Promise<Record<string, unknown>> {
  const { payload } = await jwtVerify(token, options.jwks, {
    issuer: options.issuer,
    audience: options.audience,
    algorithms: ['RS256'],
  });
  return payload as Record<string, unknown>;
}

/** Test helper — verify against a local public key instead of a JWKS HTTP endpoint. */
export async function verifyKeycloakAccessTokenWithKey(
  token: string,
  key: KeyLike | Uint8Array,
  options: Pick<KeycloakJwtVerifyOptions, 'issuer' | 'audience'>,
): Promise<Record<string, unknown>> {
  const { payload } = await jwtVerify(token, key, {
    issuer: options.issuer,
    audience: options.audience,
    algorithms: ['RS256'],
  });
  return payload as Record<string, unknown>;
}
