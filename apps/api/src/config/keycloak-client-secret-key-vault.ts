import { readFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { ClientAssertionCredential, type TokenCredential } from '@azure/identity';
import { SecretClient, type KeyVaultSecret } from '@azure/keyvault-secrets';
import { decodeJwt } from 'jose';

// TODO: Replace this module with @singleton-sd/config-kit once that shared
// package is available. It exists only to read one Keycloak client secret
// from Key Vault at startup (opt-in via PLATFORM_KIT_KV_URL).

const DEFAULT_SECRET_NAME = 'plattform-kit-keycloak-client-secret';
const SECRET_NAME_PATTERN = /^[0-9A-Za-z-]{1,127}$/;
const AZURE_AD_TOKEN_EXCHANGE_AUDIENCE = 'api://AzureADTokenExchange';
const KEYCLOAK_TOKEN_PATH = '/protocol/openid-connect/token';
const KEYCLOAK_TIMEOUT_MS = 10_000;
const VAULT_TOKEN_SCOPE = 'https://vault.azure.net/.default';
const SUCCESS_LOG = 'keycloak client secret loaded from key vault';

type EnvBag = NodeJS.Dict<string>;

type LoadStep = 'config' | 'secret-file' | 'keycloak-token' | 'azure-token' | 'key-vault';

type Log = {
  info: (message: string) => void;
  warn: (message: string) => void;
};

export type KeycloakClientSecretKeyVaultDependencies = {
  env?: EnvBag;
  fetch?: typeof fetch;
  readFile?: (path: string) => string;
  createCredential?: (
    tenantId: string,
    clientId: string,
    getAssertion: () => Promise<string>,
  ) => TokenCredential;
  createSecretClient?: (
    vaultUrl: string,
    credential: TokenCredential,
  ) => Pick<SecretClient, 'getSecret'>;
  log?: Log;
};

class LoadFailure extends Error {
  readonly step: LoadStep;
  readonly status: number | undefined;

  constructor(step: LoadStep, status?: number) {
    super(formatFailure(step, status));
    this.name = 'LoadFailure';
    this.step = step;
    this.status = status;
  }
}

/**
 * When `PLATFORM_KIT_KV_URL` is set, fetch the Keycloak client secret from
 * Azure Key Vault using Keycloak WIF (`ClientAssertionCredential`) and set
 * `process.env.KEYCLOAK_CLIENT_SECRET`. Unset, this is a no-op.
 *
 * The vault URL comes only from `PLATFORM_KIT_KV_URL`; this module never
 * hardcodes a vault name or URL.
 */
export async function loadKeycloakClientSecretFromKeyVault(
  dependencies: KeycloakClientSecretKeyVaultDependencies = {},
): Promise<void> {
  const env = dependencies.env ?? process.env;
  const vaultUrlRaw = env.PLATFORM_KIT_KV_URL?.trim();
  if (!vaultUrlRaw) {
    return;
  }

  const fetchImpl = dependencies.fetch ?? fetch;
  const readFile = dependencies.readFile ?? ((path: string) => readFileSync(path, 'utf8'));
  const createCredential =
    dependencies.createCredential ??
    ((tenantId, clientId, getAssertion) =>
      new ClientAssertionCredential(tenantId, clientId, getAssertion));
  const createSecretClient =
    dependencies.createSecretClient ??
    ((vaultUrl, credential) => new SecretClient(vaultUrl, credential));
  const log = dependencies.log ?? {
    info: (message: string) => console.log(message),
    warn: (message: string) => console.warn(message),
  };

  try {
    const config = readConfig(env, vaultUrlRaw);
    const wifSecret = readWifSecret(config.wifSecretFile, readFile);
    const getAssertion = () =>
      requestKeycloakAssertion({
        fetchImpl,
        tokenUrl: config.tokenUrl,
        clientId: config.wifClientId,
        clientSecret: wifSecret,
      });

    await getAssertion();

    const credential = createCredential(config.azureTenantId, config.azureClientId, getAssertion);

    try {
      await credential.getToken(VAULT_TOKEN_SCOPE);
    } catch (error) {
      throw toLoadFailure('azure-token', error);
    }

    let secret: KeyVaultSecret;
    try {
      secret = await createSecretClient(config.vaultUrl, credential).getSecret(config.secretName);
    } catch (error) {
      throw toLoadFailure('key-vault', error);
    }

    const value = secret.value?.trim();
    if (!value) {
      throw new LoadFailure('key-vault');
    }

    process.env.KEYCLOAK_CLIENT_SECRET = value;
    log.info(SUCCESS_LOG);
  } catch (error) {
    const failure = error instanceof LoadFailure ? error : toLoadFailure('key-vault', error);
    const fallback = existingClientSecret(env);
    if (fallback) {
      log.warn(`${failure.message}; using environment fallback`);
      return;
    }
    throw new Error(failure.message);
  }
}

function readConfig(
  env: EnvBag,
  vaultUrlRaw: string,
): {
  vaultUrl: string;
  secretName: string;
  wifSecretFile: string;
  tokenUrl: string;
  wifClientId: string;
  azureTenantId: string;
  azureClientId: string;
} {
  const vaultUrl = parseVaultUrl(vaultUrlRaw);
  const secretName = parseSecretName(env.PLATFORM_KIT_KEYCLOAK_SECRET_NAME);
  const wifSecretFile = required(env, 'PLATFORM_KIT_WIF_SECRET_FILE');
  if (!isAbsolute(wifSecretFile)) {
    throw new LoadFailure('config');
  }
  const tokenUrl = parseTokenUrl(required(env, 'PLATFORM_KIT_WIF_TOKEN_URL'));
  const wifClientId = required(env, 'PLATFORM_KIT_WIF_CLIENT_ID');
  const azureTenantId = required(env, 'PLATFORM_KIT_AZURE_TENANT_ID');
  const azureClientId = required(env, 'PLATFORM_KIT_AZURE_CLIENT_ID');
  return {
    vaultUrl,
    secretName,
    wifSecretFile,
    tokenUrl,
    wifClientId,
    azureTenantId,
    azureClientId,
  };
}

function parseVaultUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new LoadFailure('config');
  }
  if (url.protocol !== 'https:') {
    throw new LoadFailure('config');
  }
  if (!url.hostname.endsWith('.vault.azure.net')) {
    throw new LoadFailure('config');
  }
  return url.origin;
}

function parseSecretName(raw: string | undefined): string {
  const value = raw?.trim() || DEFAULT_SECRET_NAME;
  if (!SECRET_NAME_PATTERN.test(value)) {
    throw new LoadFailure('config');
  }
  return value;
}

function parseTokenUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new LoadFailure('config');
  }
  if (url.protocol !== 'https:') {
    throw new LoadFailure('config');
  }
  const path = url.pathname.replace(/\/+$/, '') || '';
  const pathname = path.endsWith(KEYCLOAK_TOKEN_PATH) ? path : `${path}${KEYCLOAK_TOKEN_PATH}`;
  return `${url.origin}${pathname}`;
}

function required(env: EnvBag, key: string): string {
  const value = env[key]?.trim();
  if (!value) {
    throw new LoadFailure('config');
  }
  return value;
}

function readWifSecret(path: string, readFile: (path: string) => string): string {
  let contents: string;
  try {
    contents = readFile(path);
  } catch (error) {
    throw toLoadFailure('secret-file', error);
  }
  const secret = trimTrailingNewline(contents);
  if (!secret) {
    throw new LoadFailure('secret-file');
  }
  return secret;
}

function trimTrailingNewline(value: string): string {
  if (value.endsWith('\r\n')) {
    return value.slice(0, -2);
  }
  if (value.endsWith('\n')) {
    return value.slice(0, -1);
  }
  return value;
}

async function requestKeycloakAssertion(input: {
  fetchImpl: typeof fetch;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
}): Promise<string> {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: input.clientId,
    client_secret: input.clientSecret,
  });

  let response: Response;
  try {
    response = await input.fetchImpl(input.tokenUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(KEYCLOAK_TIMEOUT_MS),
    });
  } catch (error) {
    throw toLoadFailure('keycloak-token', error);
  }

  if (response.status !== 200) {
    await discardBody(response);
    throw new LoadFailure('keycloak-token', response.status);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new LoadFailure('keycloak-token', 200);
  }

  if (!isRecord(payload) || typeof payload.access_token !== 'string' || !payload.access_token) {
    throw new LoadFailure('keycloak-token', 200);
  }

  let claims: ReturnType<typeof decodeJwt>;
  try {
    claims = decodeJwt(payload.access_token);
  } catch {
    throw new LoadFailure('keycloak-token', 200);
  }

  if (!audienceIncludes(claims.aud, AZURE_AD_TOKEN_EXCHANGE_AUDIENCE)) {
    throw new LoadFailure('keycloak-token', 200);
  }

  return payload.access_token;
}

function audienceIncludes(aud: unknown, expected: string): boolean {
  if (typeof aud === 'string') {
    return aud === expected;
  }
  if (Array.isArray(aud)) {
    return aud.includes(expected);
  }
  return false;
}

function existingClientSecret(env: EnvBag): string | undefined {
  const fromEnv = env.KEYCLOAK_CLIENT_SECRET?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  if (env !== process.env) {
    const fromProcess = process.env.KEYCLOAK_CLIENT_SECRET?.trim();
    if (fromProcess) {
      return fromProcess;
    }
  }
  return undefined;
}

function formatFailure(step: LoadStep, status?: number): string {
  switch (step) {
    case 'config':
    case 'secret-file':
    case 'keycloak-token':
    case 'azure-token':
    case 'key-vault':
      break;
    default: {
      const exhaustive: never = step;
      return exhaustive;
    }
  }
  const statusPart = typeof status === 'number' ? ` status=${status}` : '';
  return `failed to load keycloak client secret from key vault. step=${step}${statusPart}`;
}

function toLoadFailure(step: LoadStep, error: unknown): LoadFailure {
  if (error instanceof LoadFailure) {
    return error;
  }
  return new LoadFailure(step, httpStatus(error));
}

function httpStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }
  if ('statusCode' in error && typeof error.statusCode === 'number') {
    return error.statusCode;
  }
  if ('status' in error && typeof error.status === 'number') {
    return error.status;
  }
  return undefined;
}

async function discardBody(response: Response): Promise<void> {
  try {
    await response.arrayBuffer();
  } catch {
    // The body is discarded so it cannot leak into logs or thrown errors.
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
