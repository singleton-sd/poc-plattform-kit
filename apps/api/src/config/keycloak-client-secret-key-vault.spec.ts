import type { KeyVaultSecret } from '@azure/keyvault-secrets';
import {
  loadKeycloakClientSecretFromKeyVault,
  type KeycloakClientSecretKeyVaultDependencies,
} from './keycloak-client-secret-key-vault';

const WIF_CLIENT_ID = 'example-wif-client';
const WIF_SECRET = 'fake-wif-client-secret-do-not-use';
const FETCHED_SECRET = 'fake-keycloak-client-secret-do-not-use';
const FALLBACK_SECRET = 'fake-env-keycloak-client-secret-do-not-use';
const DEFAULT_SECRET_NAME = 'plattform-kit-keycloak-client-secret';
const SECRET_VERSION = '0123456789abcdef0123456789abcdef';
const VAULT_URL = 'https://example-vault.vault.azure.net';
const TOKEN_REALM_URL = 'https://auth.example.test/realms/example-realm';
const TOKEN_URL = `${TOKEN_REALM_URL}/protocol/openid-connect/token`;
const WIF_SECRET_FILE = '/run/example/wif-client.secret';
const AZURE_TENANT_ID = 'example-tenant-id';
const AZURE_CLIENT_ID = 'example-managed-identity-client';
const FAKE_SUBJECT = '00000000-0000-4000-8000-000000000003';
const ENTRA_ERROR_DESCRIPTION =
  'AADSTS700213: No matching federated identity record found for presented assertion subject.';
const KEYCLOAK_ERROR_DESCRIPTION = 'Invalid client or Invalid client credentials';

const KEYCLOAK_TOKEN_ISSUED_AT = 1795860000;

const consoleOutput: string[] = [];
const thrownMessages: string[] = [];
const logLines: string[] = [];

function encodeSegment(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function fakeJwt(payload: Record<string, unknown>): string {
  return `${encodeSegment({ alg: 'RS256', typ: 'JWT' })}.${encodeSegment(payload)}.fake-signature`;
}

function keycloakAccessTokenPayload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    exp: KEYCLOAK_TOKEN_ISSUED_AT + 300,
    iat: KEYCLOAK_TOKEN_ISSUED_AT,
    jti: '00000000-0000-4000-8000-000000000002',
    iss: TOKEN_REALM_URL,
    aud: 'api://AzureADTokenExchange',
    sub: FAKE_SUBJECT,
    typ: 'Bearer',
    azp: WIF_CLIENT_ID,
    client_id: WIF_CLIENT_ID,
    preferred_username: `service-account-${WIF_CLIENT_ID}`,
    ...overrides,
  };
}

const ACCESS_TOKEN = fakeJwt(keycloakAccessTokenPayload());
const WRONG_AUD_ACCESS_TOKEN = fakeJwt(keycloakAccessTokenPayload({ aud: 'account' }));

const KEYCLOAK_TOKEN_RESPONSE = {
  access_token: ACCESS_TOKEN,
  expires_in: 300,
  refresh_expires_in: 0,
  token_type: 'Bearer',
  'not-before-policy': 0,
  scope: 'basic',
};

const KEYCLOAK_INVALID_CLIENT_ERROR = {
  error: 'invalid_client',
  error_description: KEYCLOAK_ERROR_DESCRIPTION,
};

const KEY_VAULT_SECRET_REST = {
  value: FETCHED_SECRET,
  contentType: 'keycloak-client-secret',
  id: `${VAULT_URL}/secrets/${DEFAULT_SECRET_NAME}/${SECRET_VERSION}`,
  attributes: {
    enabled: true,
    created: 1795900000,
    updated: 1795900000,
    recoveryLevel: 'Recoverable+Purgeable',
    recoverableDays: 90,
  },
  tags: {
    app: 'example-app',
    env: 'prod',
  },
};

const KEY_VAULT_SECRET: KeyVaultSecret = {
  name: DEFAULT_SECRET_NAME,
  value: FETCHED_SECRET,
  properties: {
    vaultUrl: VAULT_URL,
    name: DEFAULT_SECRET_NAME,
    version: SECRET_VERSION,
    enabled: true,
    contentType: 'keycloak-client-secret',
    createdOn: new Date(1795900000 * 1000),
    updatedOn: new Date(1795900000 * 1000),
    tags: {
      app: 'example-app',
      env: 'prod',
    },
  },
};

const KEY_VAULT_FORBIDDEN = {
  error: {
    code: 'Forbidden',
    message: 'Caller is not authorized to perform action on resource.',
    innererror: { code: 'AccessDenied' },
  },
};

const KEY_VAULT_NOT_FOUND = {
  error: {
    code: 'SecretNotFound',
    message: `A secret with (name/id) ${DEFAULT_SECRET_NAME} was not found in this key vault.`,
  },
};

const ENTRA_TOKEN_ERROR = {
  error: 'invalid_client',
  error_description: ENTRA_ERROR_DESCRIPTION,
  error_codes: [700213],
  timestamp: '2026-11-28 12:00:00Z',
  trace_id: '00000000-0000-0000-0000-000000000000',
  correlation_id: '00000000-0000-0000-0000-000000000001',
};

const ENTRA_TOKEN_RESPONSE = {
  token_type: 'Bearer',
  expires_in: 86399,
  ext_expires_in: 86399,
  access_token: 'fake-azure-token',
};

function enabledEnv(overrides: Record<string, string | undefined> = {}): Record<string, string> {
  const env: Record<string, string | undefined> = {
    PLATFORM_KIT_KV_URL: VAULT_URL,
    PLATFORM_KIT_WIF_SECRET_FILE: WIF_SECRET_FILE,
    PLATFORM_KIT_WIF_TOKEN_URL: TOKEN_REALM_URL,
    PLATFORM_KIT_WIF_CLIENT_ID: WIF_CLIENT_ID,
    PLATFORM_KIT_AZURE_TENANT_ID: AZURE_TENANT_ID,
    PLATFORM_KIT_AZURE_CLIENT_ID: AZURE_CLIENT_ID,
    ...overrides,
  };
  return Object.fromEntries(
    Object.entries(env).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function keycloakOkFetch(url: string | URL | Request, init?: RequestInit): Promise<Response> {
  void url;
  void init;
  return Promise.resolve(jsonResponse(200, KEYCLOAK_TOKEN_RESPONSE));
}

function capturingLog(): { info: (message: string) => void; warn: (message: string) => void } {
  return {
    info: (message: string) => {
      logLines.push(message);
    },
    warn: (message: string) => {
      logLines.push(message);
    },
  };
}

function stubCredential(
  getAssertion: () => Promise<string>,
  getToken: () => Promise<{ token: string; expiresOnTimestamp: number }>,
): {
  getToken: () => Promise<{ token: string; expiresOnTimestamp: number }>;
} {
  void getAssertion;
  return { getToken };
}

function successfulDeps(
  overrides: KeycloakClientSecretKeyVaultDependencies = {},
): KeycloakClientSecretKeyVaultDependencies {
  const fetchImpl = overrides.fetch ?? jest.fn(keycloakOkFetch);
  const readFile = overrides.readFile ?? jest.fn(() => `${WIF_SECRET}\n`);
  const getSecret =
    overrides.createSecretClient ??
    jest.fn((_vaultUrl: string, _credential: unknown) => ({
      getSecret: jest.fn(async () => KEY_VAULT_SECRET),
    }));
  return {
    env: enabledEnv(),
    fetch: fetchImpl,
    readFile,
    createCredential:
      overrides.createCredential ??
      ((tenantId, clientId, getAssertion) => {
        void tenantId;
        void clientId;
        return stubCredential(getAssertion, async () => ({
          token: ENTRA_TOKEN_RESPONSE.access_token,
          expiresOnTimestamp: Date.now() + 86_399_000,
        }));
      }),
    createSecretClient: getSecret,
    log: capturingLog(),
    ...overrides,
  };
}

function formBody(init?: RequestInit): URLSearchParams {
  const body = init?.body;
  if (body instanceof URLSearchParams) {
    return body;
  }
  if (typeof body === 'string') {
    return new URLSearchParams(body);
  }
  throw new Error('expected application/x-www-form-urlencoded body');
}

function headerValue(init: RequestInit | undefined, name: string): string | undefined {
  const headers = init?.headers;
  if (!headers) {
    return undefined;
  }
  if (headers instanceof Headers) {
    return headers.get(name) ?? undefined;
  }
  if (Array.isArray(headers)) {
    const match = headers.find(([key]) => key.toLowerCase() === name.toLowerCase());
    return match?.[1];
  }
  const record = headers as Record<string, string>;
  return record[name] ?? record[name.toLowerCase()] ?? record['Content-Type'];
}

function azureError(statusCode: number, details: unknown): Error {
  const error = new Error('request failed') as Error & {
    statusCode: number;
    details?: unknown;
  };
  error.name = 'RestError';
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

function leakHaystack(): string {
  return [...consoleOutput, ...logLines, ...thrownMessages].join('\n');
}

function expectNoSecrets(haystack: string): void {
  expect(haystack).not.toContain(WIF_SECRET);
  expect(haystack).not.toContain(FETCHED_SECRET);
  expect(haystack).not.toContain(ACCESS_TOKEN);
  expect(haystack).not.toContain(WRONG_AUD_ACCESS_TOKEN);
  expect(haystack).not.toContain('error_description');
  expect(haystack).not.toContain(ENTRA_ERROR_DESCRIPTION);
  expect(haystack).not.toContain(KEYCLOAK_ERROR_DESCRIPTION);
  expect(haystack).not.toContain(SECRET_VERSION);
  expect(haystack).not.toContain('fake-azure-token');
}

async function expectFallback(options: {
  deps: KeycloakClientSecretKeyVaultDependencies;
  step: string;
  status?: number;
}): Promise<void> {
  process.env.KEYCLOAK_CLIENT_SECRET = FALLBACK_SECRET;
  const env = {
    ...(options.deps.env as Record<string, string> | undefined),
    KEYCLOAK_CLIENT_SECRET: FALLBACK_SECRET,
  };
  await loadKeycloakClientSecretFromKeyVault({
    ...options.deps,
    env,
    log: options.deps.log ?? capturingLog(),
  });
  expect(process.env.KEYCLOAK_CLIENT_SECRET).toBe(FALLBACK_SECRET);
  expect(logLines).toHaveLength(1);
  expect(logLines[0]).toContain(`step=${options.step}`);
  if (typeof options.status === 'number') {
    expect(logLines[0]).toContain(`status=${options.status}`);
  } else {
    expect(logLines[0]).not.toMatch(/status=/);
  }
  expect(logLines[0]).toContain('using environment fallback');
  expectNoSecrets(logLines[0]);
}

async function expectStartupFailure(options: {
  deps: KeycloakClientSecretKeyVaultDependencies;
  step: string;
  status?: number;
}): Promise<void> {
  delete process.env.KEYCLOAK_CLIENT_SECRET;
  const env = { ...(options.deps.env as Record<string, string> | undefined) };
  delete env.KEYCLOAK_CLIENT_SECRET;
  try {
    await loadKeycloakClientSecretFromKeyVault({
      ...options.deps,
      env,
      log: options.deps.log ?? capturingLog(),
    });
    throw new Error('expected loadKeycloakClientSecretFromKeyVault to reject');
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    thrownMessages.push(message);
    expect(message).toContain(`step=${options.step}`);
    if (typeof options.status === 'number') {
      expect(message).toContain(`status=${options.status}`);
    } else {
      expect(message).not.toMatch(/status=/);
    }
    expectNoSecrets(message);
  }
  expect(logLines).toHaveLength(0);
  expect(process.env.KEYCLOAK_CLIENT_SECRET).toBeUndefined();
}

describe('loadKeycloakClientSecretFromKeyVault', () => {
  const originalEnv = process.env;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.KEYCLOAK_CLIENT_SECRET;
    delete process.env.PLATFORM_KIT_KV_URL;
    logLines.length = 0;
    logSpy = jest.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      consoleOutput.push(args.map(String).join(' '));
    });
    warnSpy = jest.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
      consoleOutput.push(args.map(String).join(' '));
    });
    errorSpy = jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      consoleOutput.push(args.map(String).join(' '));
    });
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  afterAll(() => {
    process.env = originalEnv;
    expectNoSecrets(leakHaystack());
  });

  describe('disabled', () => {
    it.each([undefined, '', '   '])(
      'does nothing when PLATFORM_KIT_KV_URL is %j',
      async (vaultUrl) => {
        const fetchImpl = jest.fn();
        const readFile = jest.fn();
        const createSecretClient = jest.fn();
        const log = capturingLog();
        process.env.KEYCLOAK_CLIENT_SECRET = FALLBACK_SECRET;
        const env: Record<string, string> = { KEYCLOAK_CLIENT_SECRET: FALLBACK_SECRET };
        if (typeof vaultUrl === 'string') {
          env.PLATFORM_KIT_KV_URL = vaultUrl;
        }

        await loadKeycloakClientSecretFromKeyVault({
          env,
          fetch: fetchImpl,
          readFile,
          createSecretClient,
          log,
        });

        expect(fetchImpl).not.toHaveBeenCalled();
        expect(readFile).not.toHaveBeenCalled();
        expect(createSecretClient).not.toHaveBeenCalled();
        expect(logLines).toHaveLength(0);
        expect(process.env.KEYCLOAK_CLIENT_SECRET).toBe(FALLBACK_SECRET);
      },
    );

    it('leaves KEYCLOAK_CLIENT_SECRET unset when the opt-in var is missing', async () => {
      const fetchImpl = jest.fn();
      const readFile = jest.fn();
      const createSecretClient = jest.fn();

      await loadKeycloakClientSecretFromKeyVault({
        env: {},
        fetch: fetchImpl,
        readFile,
        createSecretClient,
        log: capturingLog(),
      });

      expect(fetchImpl).not.toHaveBeenCalled();
      expect(readFile).not.toHaveBeenCalled();
      expect(createSecretClient).not.toHaveBeenCalled();
      expect(logLines).toHaveLength(0);
      expect(process.env.KEYCLOAK_CLIENT_SECRET).toBeUndefined();
    });
  });

  describe('happy path', () => {
    it('loads the Keycloak client secret from Key Vault and records the source', async () => {
      const fetchImpl = jest.fn(keycloakOkFetch);
      const readFile = jest.fn(() => `${WIF_SECRET}\n`);
      const getSecret = jest.fn(async (name: string) => {
        expect(name).toBe(DEFAULT_SECRET_NAME);
        return KEY_VAULT_SECRET;
      });
      const createSecretClient = jest.fn((_vaultUrl: string, _credential: unknown) => ({
        getSecret,
      }));

      await loadKeycloakClientSecretFromKeyVault(
        successfulDeps({ fetch: fetchImpl, readFile, createSecretClient }),
      );

      expect(readFile).toHaveBeenCalledWith(WIF_SECRET_FILE);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      const [url, init] = fetchImpl.mock.calls[0];
      expect(url).toBe(TOKEN_URL);
      expect(init?.method).toBe('POST');
      expect(headerValue(init, 'content-type')).toBe('application/x-www-form-urlencoded');
      const body = formBody(init);
      expect(body.get('grant_type')).toBe('client_credentials');
      expect(body.get('client_id')).toBe(WIF_CLIENT_ID);
      expect(body.get('client_secret')).toBe(WIF_SECRET);
      expect(createSecretClient).toHaveBeenCalledWith(VAULT_URL, expect.anything());
      expect(getSecret).toHaveBeenCalledWith(
        DEFAULT_SECRET_NAME,
        expect.objectContaining({ abortSignal: expect.any(AbortSignal) }),
      );
      expect(process.env.KEYCLOAK_CLIENT_SECRET).toBe(FETCHED_SECRET);
      expect(logLines).toEqual(['keycloak client secret loaded from key vault']);
      expectNoSecrets(logLines[0]);
      expect(KEY_VAULT_SECRET.value).toBe(KEY_VAULT_SECRET_REST.value);
      expect(KEY_VAULT_SECRET.properties.version).toBe(KEY_VAULT_SECRET_REST.id.split('/').pop());
      expect(KEY_VAULT_SECRET.properties.contentType).toBe(KEY_VAULT_SECRET_REST.contentType);
      expect(KEY_VAULT_SECRET.properties.tags).toEqual(KEY_VAULT_SECRET_REST.tags);
    });

    it('asks Key Vault for a custom secret name', async () => {
      const getSecret = jest.fn(async (name: string) => ({
        ...KEY_VAULT_SECRET,
        name,
        properties: { ...KEY_VAULT_SECRET.properties, name },
      }));
      const createSecretClient = jest.fn(() => ({ getSecret }));

      await loadKeycloakClientSecretFromKeyVault(
        successfulDeps({
          env: enabledEnv({ PLATFORM_KIT_KEYCLOAK_SECRET_NAME: 'custom-keycloak-secret' }),
          createSecretClient,
        }),
      );

      expect(getSecret).toHaveBeenCalledWith(
        'custom-keycloak-secret',
        expect.objectContaining({ abortSignal: expect.any(AbortSignal) }),
      );
      expect(process.env.KEYCLOAK_CLIENT_SECRET).toBe(FETCHED_SECRET);
    });

    it('bounds Azure token and Key Vault calls with abort signals', async () => {
      const getToken = jest.fn(
        async (_scopes: string | string[], options?: { abortSignal?: AbortSignal }) => {
          expect(options?.abortSignal).toBeInstanceOf(AbortSignal);
          expect(options?.abortSignal?.aborted).toBe(false);
          return {
            token: ENTRA_TOKEN_RESPONSE.access_token,
            expiresOnTimestamp: Date.now() + 86_399_000,
          };
        },
      );
      const getSecret = jest.fn(async (_name: string, options?: { abortSignal?: AbortSignal }) => {
        expect(options?.abortSignal).toBeInstanceOf(AbortSignal);
        expect(options?.abortSignal?.aborted).toBe(false);
        return KEY_VAULT_SECRET;
      });

      await loadKeycloakClientSecretFromKeyVault(
        successfulDeps({
          createCredential: () => ({ getToken }),
          createSecretClient: () => ({ getSecret }),
        }),
      );

      expect(getToken).toHaveBeenCalledWith(
        'https://vault.azure.net/.default',
        expect.objectContaining({ abortSignal: expect.any(AbortSignal) }),
      );
      expect(getSecret).toHaveBeenCalledWith(
        DEFAULT_SECRET_NAME,
        expect.objectContaining({ abortSignal: expect.any(AbortSignal) }),
      );
      expect(process.env.KEYCLOAK_CLIENT_SECRET).toBe(FETCHED_SECRET);
    });

    it('appends the token path when PLATFORM_KIT_WIF_TOKEN_URL is a realm URL', async () => {
      const fetchImpl = jest.fn(keycloakOkFetch);

      await loadKeycloakClientSecretFromKeyVault(successfulDeps({ fetch: fetchImpl }));

      expect(fetchImpl.mock.calls[0][0]).toBe(TOKEN_URL);
    });

    it('does not append the token path when the token URL already has it', async () => {
      const fetchImpl = jest.fn(keycloakOkFetch);

      await loadKeycloakClientSecretFromKeyVault(
        successfulDeps({
          env: enabledEnv({ PLATFORM_KIT_WIF_TOKEN_URL: TOKEN_URL }),
          fetch: fetchImpl,
        }),
      );

      expect(fetchImpl.mock.calls[0][0]).toBe(TOKEN_URL);
    });
  });

  it('lets a successful Key Vault read replace a different env value', async () => {
    process.env.KEYCLOAK_CLIENT_SECRET = FALLBACK_SECRET;

    await loadKeycloakClientSecretFromKeyVault(
      successfulDeps({
        env: enabledEnv({ KEYCLOAK_CLIENT_SECRET: FALLBACK_SECRET }),
      }),
    );

    expect(process.env.KEYCLOAK_CLIENT_SECRET).toBe(FETCHED_SECRET);
  });

  it('fetches a new Keycloak token on each assertion callback', async () => {
    const fetchImpl = jest.fn(keycloakOkFetch);
    let getAssertion: (() => Promise<string>) | undefined;

    await loadKeycloakClientSecretFromKeyVault(
      successfulDeps({
        fetch: fetchImpl,
        createCredential: (_tenantId, _clientId, assertion) => {
          getAssertion = assertion;
          return stubCredential(assertion, async () => ({
            token: ENTRA_TOKEN_RESPONSE.access_token,
            expiresOnTimestamp: Date.now() + 86_399_000,
          }));
        },
      }),
    );

    expect(getAssertion).toBeDefined();
    const callsAfterLoad = fetchImpl.mock.calls.length;
    await getAssertion!();
    await getAssertion!();
    expect(fetchImpl).toHaveBeenCalledTimes(callsAfterLoad + 2);
    expect(formBody(fetchImpl.mock.calls.at(-1)?.[1]).get('client_secret')).toBe(WIF_SECRET);
  });

  describe('fallback and fail-closed', () => {
    it.each([
      {
        name: 'missing required var',
        step: 'config',
        deps: () => successfulDeps({ env: enabledEnv({ PLATFORM_KIT_WIF_CLIENT_ID: undefined }) }),
      },
      {
        name: 'unreadable file',
        step: 'secret-file',
        deps: () =>
          successfulDeps({
            readFile: () => {
              throw new Error('ENOENT: no such file');
            },
          }),
      },
      {
        name: 'empty file',
        step: 'secret-file',
        deps: () => successfulDeps({ readFile: () => '\n' }),
      },
      {
        name: 'Keycloak 401',
        step: 'keycloak-token',
        status: 401,
        deps: () =>
          successfulDeps({
            fetch: jest.fn(async () => jsonResponse(401, KEYCLOAK_INVALID_CLIENT_ERROR)),
          }),
      },
      {
        name: 'wrong audience',
        step: 'keycloak-token',
        status: 200,
        deps: () =>
          successfulDeps({
            fetch: jest.fn(async () =>
              jsonResponse(200, {
                ...KEYCLOAK_TOKEN_RESPONSE,
                access_token: WRONG_AUD_ACCESS_TOKEN,
              }),
            ),
          }),
      },
      {
        name: 'non-JWT access_token',
        step: 'keycloak-token',
        status: 200,
        deps: () =>
          successfulDeps({
            fetch: jest.fn(async () =>
              jsonResponse(200, { ...KEYCLOAK_TOKEN_RESPONSE, access_token: 'not-a-jwt' }),
            ),
          }),
      },
      {
        name: 'Keycloak timeout',
        step: 'keycloak-token',
        deps: () =>
          successfulDeps({
            fetch: jest.fn(async () => {
              const error = new Error('The operation was aborted due to timeout');
              error.name = 'TimeoutError';
              throw error;
            }),
          }),
      },
      {
        name: 'Azure token failure',
        step: 'azure-token',
        status: 400,
        deps: () =>
          successfulDeps({
            createCredential: () => ({
              getToken: async () => {
                throw azureError(400, ENTRA_TOKEN_ERROR);
              },
            }),
          }),
      },
      {
        name: 'Azure token timeout',
        step: 'azure-token',
        deps: () =>
          successfulDeps({
            createCredential: () => ({
              getToken: async () => {
                const error = new Error('The operation was aborted due to timeout');
                error.name = 'TimeoutError';
                throw error;
              },
            }),
          }),
      },
      {
        name: 'Key Vault 403',
        step: 'key-vault',
        status: 403,
        deps: () =>
          successfulDeps({
            createSecretClient: () => ({
              getSecret: async () => {
                throw azureError(403, KEY_VAULT_FORBIDDEN);
              },
            }),
          }),
      },
      {
        name: 'Key Vault timeout',
        step: 'key-vault',
        deps: () =>
          successfulDeps({
            createSecretClient: () => ({
              getSecret: async () => {
                const error = new Error('The operation was aborted due to timeout');
                error.name = 'TimeoutError';
                throw error;
              },
            }),
          }),
      },
      {
        name: 'Key Vault 404',
        step: 'key-vault',
        status: 404,
        deps: () =>
          successfulDeps({
            createSecretClient: () => ({
              getSecret: async () => {
                throw azureError(404, KEY_VAULT_NOT_FOUND);
              },
            }),
          }),
      },
      {
        name: 'empty Key Vault value',
        step: 'key-vault',
        deps: () =>
          successfulDeps({
            createSecretClient: () => ({
              getSecret: async () => ({ ...KEY_VAULT_SECRET, value: '' }),
            }),
          }),
      },
    ])('$name falls back when KEYCLOAK_CLIENT_SECRET is set', async ({ deps, step, status }) => {
      await expectFallback({ deps: deps(), step, status });
    });

    it.each([
      {
        name: 'missing required var',
        step: 'config',
        deps: () => successfulDeps({ env: enabledEnv({ PLATFORM_KIT_WIF_CLIENT_ID: undefined }) }),
      },
      {
        name: 'unreadable file',
        step: 'secret-file',
        deps: () =>
          successfulDeps({
            readFile: () => {
              throw new Error('ENOENT: no such file');
            },
          }),
      },
      {
        name: 'empty file',
        step: 'secret-file',
        deps: () => successfulDeps({ readFile: () => '' }),
      },
      {
        name: 'Keycloak 401',
        step: 'keycloak-token',
        status: 401,
        deps: () =>
          successfulDeps({
            fetch: jest.fn(async () => jsonResponse(401, KEYCLOAK_INVALID_CLIENT_ERROR)),
          }),
      },
      {
        name: 'wrong audience',
        step: 'keycloak-token',
        status: 200,
        deps: () =>
          successfulDeps({
            fetch: jest.fn(async () =>
              jsonResponse(200, {
                ...KEYCLOAK_TOKEN_RESPONSE,
                access_token: WRONG_AUD_ACCESS_TOKEN,
              }),
            ),
          }),
      },
      {
        name: 'non-JWT access_token',
        step: 'keycloak-token',
        status: 200,
        deps: () =>
          successfulDeps({
            fetch: jest.fn(async () =>
              jsonResponse(200, { ...KEYCLOAK_TOKEN_RESPONSE, access_token: 'not-a-jwt' }),
            ),
          }),
      },
      {
        name: 'Keycloak timeout',
        step: 'keycloak-token',
        deps: () =>
          successfulDeps({
            fetch: jest.fn(async () => {
              const error = new Error('The operation was aborted due to timeout');
              error.name = 'TimeoutError';
              throw error;
            }),
          }),
      },
      {
        name: 'Azure token failure',
        step: 'azure-token',
        status: 400,
        deps: () =>
          successfulDeps({
            createCredential: () => ({
              getToken: async () => {
                throw azureError(400, ENTRA_TOKEN_ERROR);
              },
            }),
          }),
      },
      {
        name: 'Azure token timeout',
        step: 'azure-token',
        deps: () =>
          successfulDeps({
            createCredential: () => ({
              getToken: async () => {
                const error = new Error('The operation was aborted due to timeout');
                error.name = 'TimeoutError';
                throw error;
              },
            }),
          }),
      },
      {
        name: 'Key Vault 403',
        step: 'key-vault',
        status: 403,
        deps: () =>
          successfulDeps({
            createSecretClient: () => ({
              getSecret: async () => {
                throw azureError(403, KEY_VAULT_FORBIDDEN);
              },
            }),
          }),
      },
      {
        name: 'Key Vault timeout',
        step: 'key-vault',
        deps: () =>
          successfulDeps({
            createSecretClient: () => ({
              getSecret: async () => {
                const error = new Error('The operation was aborted due to timeout');
                error.name = 'TimeoutError';
                throw error;
              },
            }),
          }),
      },
      {
        name: 'Key Vault 404',
        step: 'key-vault',
        status: 404,
        deps: () =>
          successfulDeps({
            createSecretClient: () => ({
              getSecret: async () => {
                throw azureError(404, KEY_VAULT_NOT_FOUND);
              },
            }),
          }),
      },
      {
        name: 'empty Key Vault value',
        step: 'key-vault',
        deps: () =>
          successfulDeps({
            createSecretClient: () => ({
              getSecret: async () => ({ ...KEY_VAULT_SECRET, value: '   ' }),
            }),
          }),
      },
    ])(
      '$name fails startup when KEYCLOAK_CLIENT_SECRET is unset',
      async ({ deps, step, status }) => {
        await expectStartupFailure({ deps: deps(), step, status });
      },
    );
  });

  describe('config validation', () => {
    it.each([
      {
        name: 'non-https vault URL',
        env: enabledEnv({ PLATFORM_KIT_KV_URL: 'http://example-vault.vault.azure.net' }),
      },
      {
        name: 'vault host not ending in .vault.azure.net',
        env: enabledEnv({ PLATFORM_KIT_KV_URL: 'https://example.test' }),
      },
      {
        name: 'non-https token URL',
        env: enabledEnv({
          PLATFORM_KIT_WIF_TOKEN_URL: 'http://auth.example.test/realms/example-realm',
        }),
      },
      {
        name: 'bad secret name',
        env: enabledEnv({ PLATFORM_KIT_KEYCLOAK_SECRET_NAME: 'oops_secret' }),
      },
      {
        name: 'relative WIF secret file',
        env: enabledEnv({ PLATFORM_KIT_WIF_SECRET_FILE: 'wif-client.secret' }),
      },
    ])('treats $name as a config failure without network calls', async ({ env }) => {
      const fetchImpl = jest.fn();
      const readFile = jest.fn();
      const createSecretClient = jest.fn();
      const deps = successfulDeps({ env, fetch: fetchImpl, readFile, createSecretClient });

      await expectFallback({ deps, step: 'config' });
      expect(fetchImpl).not.toHaveBeenCalled();
      expect(readFile).not.toHaveBeenCalled();
      expect(createSecretClient).not.toHaveBeenCalled();

      logLines.length = 0;
      await expectStartupFailure({
        deps: successfulDeps({ env, fetch: fetchImpl, readFile, createSecretClient }),
        step: 'config',
      });
      expect(fetchImpl).not.toHaveBeenCalled();
    });
  });

  it('does not put secrets, tokens, or error_description in logs or thrown errors', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse(401, KEYCLOAK_INVALID_CLIENT_ERROR));
    await expectFallback({
      deps: successfulDeps({ fetch: fetchImpl }),
      step: 'keycloak-token',
      status: 401,
    });
    logLines.length = 0;
    await expectStartupFailure({
      deps: successfulDeps({
        createCredential: () => ({
          getToken: async () => {
            throw azureError(400, ENTRA_TOKEN_ERROR);
          },
        }),
      }),
      step: 'azure-token',
      status: 400,
    });
    expectNoSecrets(leakHaystack());
  });
});
