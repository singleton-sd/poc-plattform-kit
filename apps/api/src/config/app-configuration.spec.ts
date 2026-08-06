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

    const listSettings = jest
      .fn()
      .mockReturnValue(
        settings(
          setting('app:cors:origins', 'https://app.example.com'),
          setting(
            'secret:database-url',
            JSON.stringify({ uri: 'https://vault.vault.azure.net/secrets/database-url' }),
            'application/vnd.microsoft.appconfig.keyvaultref+json;charset=utf-8',
          ),
          setting('unmapped:key', 'ignored'),
        ),
      );
    const getSecret = jest.fn().mockResolvedValue({ value: 'sqlserver://secret' });

    await loadAppConfiguration({ listSettings, getSecret });

    expect(process.env.CORS_ORIGINS).toBe('https://app.example.com');
    expect(process.env.DATABASE_URL).toBe('sqlserver://secret');
    expect(getSecret).toHaveBeenCalledWith('https://vault.vault.azure.net/secrets/database-url');
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
