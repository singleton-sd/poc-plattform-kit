import type { ConfigurationSetting } from '@azure/app-configuration';
import { loadAppConfiguration } from './app-configuration';

describe('loadAppConfiguration', () => {
  const originalEnvironment = process.env;

  beforeEach(() => {
    process.env = {};
  });

  afterAll(() => {
    process.env = originalEnvironment;
  });

  it('does nothing when no endpoint is configured', async () => {
    const listSettings = jest.fn();

    await loadAppConfiguration({ listSettings });

    expect(listSettings).not.toHaveBeenCalled();
  });

  it('maps plain settings and Key Vault references to environment variables', async () => {
    process.env.AZURE_APPCONFIGURATION_ENDPOINT = 'https://example.azconfig.io';

    const listSettings = jest.fn().mockReturnValue(
      settings(
        setting('app:cors:origins', 'https://app.example.com'),
        setting('app:throttle:limit', '25'),
        setting('app:throttle:ttlMs', '30000'),
        setting('app:azureAd:clientId', 'entra-client-id'),
        setting('app:azureAd:tenantId', 'entra-tenant-id'),
        setting('app:azureAd:apiAudience', 'api://platform-kit'),
        setting('app:openfga:apiUrl', 'https://openfga.example.test'),
        setting('app:openfga:storeId', 'store-1'),
        setting('app:openfga:authorizationModelId', 'model-1'),
        setting('app:openfga:audience', 'api://ssd-pocpk-openfga'),
        setting('app:azureAd:swaggerScope', 'entra-client-id/.default'),
        setting('app:notifications:emailSendingDomain', 'mail.example.test'),
        setting('app:notifications:emailDkimSelector', 'fe'),
        setting('app:notifications:emailDmarcPolicy', 'reject'),
        setting('app:notifications:emailDmarcRua', 'mailto:dmarc@example.test'),
        setting(
          'secret:database-url',
          JSON.stringify({ uri: 'https://vault.vault.azure.net/secrets/database-url' }),
          'application/vnd.microsoft.appconfig.keyvaultref+json;charset=utf-8',
        ),
        setting(
          'secret:servicebus-connection-string',
          JSON.stringify({
            uri: 'https://vault.vault.azure.net/secrets/servicebus-connection-string',
          }),
          'application/vnd.microsoft.appconfig.keyvaultref+json;charset=utf-8',
        ),
        setting(
          'secret:auth-secret',
          JSON.stringify({ uri: 'https://vault.vault.azure.net/secrets/auth-secret' }),
          'application/vnd.microsoft.appconfig.keyvaultref+json;charset=utf-8',
        ),
        setting(
          'secret:azure-ad-client-secret',
          JSON.stringify({
            uri: 'https://vault.vault.azure.net/secrets/azure-ad-client-secret',
          }),
          'application/vnd.microsoft.appconfig.keyvaultref+json;charset=utf-8',
        ),
        setting('unmapped:key', 'ignored'),
      ),
    );
    const getSecret = jest.fn().mockImplementation(async (secretUri: string) => {
      if (secretUri.includes('auth-secret')) return { value: 'auth-js-secret' };
      if (secretUri.includes('azure-ad-client-secret')) return { value: 'entra-client-secret' };
      return { value: 'sqlserver://secret' };
    });

    await loadAppConfiguration({ listSettings, getSecret });

    expect(process.env.CORS_ORIGINS).toBe('https://app.example.com');
    expect(process.env.API_THROTTLE_LIMIT).toBe('25');
    expect(process.env.API_THROTTLE_TTL_MS).toBe('30000');
    expect(process.env.AZURE_AD_CLIENT_ID).toBe('entra-client-id');
    expect(process.env.AZURE_AD_TENANT_ID).toBe('entra-tenant-id');
    expect(process.env.AZURE_AD_API_AUDIENCE).toBe('api://platform-kit');
    expect(process.env.OPENFGA_API_URL).toBe('https://openfga.example.test');
    expect(process.env.OPENFGA_STORE_ID).toBe('store-1');
    expect(process.env.OPENFGA_AUTHORIZATION_MODEL_ID).toBe('model-1');
    expect(process.env.OPENFGA_AUDIENCE).toBe('api://ssd-pocpk-openfga');
    expect(process.env.AZURE_AD_SWAGGER_SCOPE).toBe('entra-client-id/.default');
    expect(process.env.EMAIL_SENDING_DOMAIN).toBe('mail.example.test');
    expect(process.env.EMAIL_DKIM_SELECTOR).toBe('fe');
    expect(process.env.EMAIL_DMARC_POLICY).toBe('reject');
    expect(process.env.EMAIL_DMARC_RUA).toBe('mailto:dmarc@example.test');
    expect(process.env.AUTH_SECRET).toBe('auth-js-secret');
    expect(process.env.AZURE_AD_CLIENT_SECRET).toBe('entra-client-secret');
    expect(process.env.DATABASE_URL).toBe('sqlserver://secret');
    expect(process.env.AZURE_SERVICEBUS_CONNECTION_STRING).toBe('sqlserver://secret');
    expect(getSecret).toHaveBeenCalledTimes(4);
    expect(process.env.UNMAPPED_KEY).toBeUndefined();
  });

  it('preserves explicitly configured environment variables', async () => {
    process.env.AZURE_APPCONFIGURATION_ENDPOINT = 'https://example.azconfig.io';
    process.env.CORS_ORIGINS = 'https://override.example.com';

    await loadAppConfiguration({
      listSettings: jest.fn().mockReturnValue(settings(setting('app:cors:origins', 'from-store'))),
    });

    expect(process.env.CORS_ORIGINS).toBe('https://override.example.com');
  });

  it('rejects malformed Key Vault references', async () => {
    process.env.AZURE_APPCONFIGURATION_ENDPOINT = 'https://example.azconfig.io';

    await expect(
      loadAppConfiguration({
        listSettings: jest
          .fn()
          .mockReturnValue(
            settings(
              setting(
                'secret:database-url',
                '{}',
                'application/vnd.microsoft.appconfig.keyvaultref+json',
              ),
            ),
          ),
      }),
    ).rejects.toThrow('Invalid Key Vault reference for secret:database-url');
  });
});

function setting(key: string, value: string, contentType?: string): ConfigurationSetting {
  return { key, value, contentType } as ConfigurationSetting;
}

async function* settings(...values: ConfigurationSetting[]) {
  yield* values;
}
