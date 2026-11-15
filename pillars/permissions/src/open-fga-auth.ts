/**
 * OpenFGA HTTP credentials. Exactly one method is allowed when the client is
 * configured (URL + store):
 *
 * - `OPENFGA_API_TOKEN` — preshared key, equivalent to the OpenFGA SDK
 *   `CredentialsMethod.ApiToken` (`Authorization: Bearer <token>`).
 * - `OPENFGA_AUDIENCE` — Entra token via `DefaultAzureCredential`.
 *
 * Both or (configured and neither) fail closed. Never log the token.
 */

export const OPENFGA_AUTH_BOTH_ERROR =
  'OpenFGA auth is misconfigured: set OPENFGA_API_TOKEN or OPENFGA_AUDIENCE, not both';

export const OPENFGA_AUTH_NEITHER_ERROR =
  'OpenFGA auth is misconfigured: set OPENFGA_API_TOKEN or OPENFGA_AUDIENCE';

export type OpenFgaAuthMode = 'api-token' | 'azure' | 'none';

function trimmed(env: NodeJS.ProcessEnv, key: string): string {
  return env[key]?.trim() ?? '';
}

export function isOpenFgaConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(trimmed(env, 'OPENFGA_API_URL') && trimmed(env, 'OPENFGA_STORE_ID'));
}

export function resolveOpenFgaAuthMode(env: NodeJS.ProcessEnv = process.env): OpenFgaAuthMode {
  const apiToken = trimmed(env, 'OPENFGA_API_TOKEN');
  const audience = trimmed(env, 'OPENFGA_AUDIENCE');

  if (apiToken && audience) {
    throw new Error(OPENFGA_AUTH_BOTH_ERROR);
  }
  if (apiToken) {
    return 'api-token';
  }
  if (audience) {
    return 'azure';
  }
  return 'none';
}

/** Fail closed at Nest startup when OpenFGA auth cannot be chosen unambiguously. */
export function assertOpenFgaAuthConfig(env: NodeJS.ProcessEnv = process.env): void {
  const mode = resolveOpenFgaAuthMode(env);
  if (isOpenFgaConfigured(env) && mode === 'none') {
    throw new Error(OPENFGA_AUTH_NEITHER_ERROR);
  }
}

/** OpenFGA SDK `CredentialsMethod.ApiToken` header. The token is not logged. */
export function openFgaApiTokenHeader(
  env: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  return { authorization: `Bearer ${trimmed(env, 'OPENFGA_API_TOKEN')}` };
}
