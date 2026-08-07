import { AppConfigurationClient, type ConfigurationSetting } from '@azure/app-configuration';
import { DefaultAzureCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';

const keyVaultReferenceContentType = 'application/vnd.microsoft.appconfig.keyvaultref+json';

const environmentKeys: Readonly<Record<string, string>> = {
  'app:azureAd:apiAudience': 'AZURE_AD_API_AUDIENCE',
  'app:azureAd:clientId': 'AZURE_AD_CLIENT_ID',
  'app:azureAd:tenantId': 'AZURE_AD_TENANT_ID',
  'app:cors:origins': 'CORS_ORIGINS',
  'app:auth:url': 'AUTH_URL',
  'app:auth:cookieDomain': 'AUTH_COOKIE_DOMAIN',
  'app:telemetry:cloudRoleName:api': 'APPLICATIONINSIGHTS_CLOUD_ROLE_NAME',
  'secret:appinsights-connection-string': 'APPLICATIONINSIGHTS_CONNECTION_STRING',
  'secret:auth-secret': 'AUTH_SECRET',
  'secret:azure-ad-client-secret': 'AZURE_AD_CLIENT_SECRET',
  'secret:database-url': 'DATABASE_URL',
  'secret:servicebus-connection-string': 'AZURE_SERVICEBUS_CONNECTION_STRING',
};

type AppConfigurationDependencies = {
  listSettings?: () => AsyncIterable<ConfigurationSetting>;
  getSecret?: (secretUri: string) => Promise<{ value?: string }>;
};

/**
 * Populate process.env from the shared App Configuration store before Nest
 * and telemetry are imported. Explicit environment variables always win,
 * which keeps local development and emergency runtime overrides predictable.
 */
export async function loadAppConfiguration(
  dependencies: AppConfigurationDependencies = {},
): Promise<void> {
  const endpoint = process.env.AZURE_APPCONFIGURATION_ENDPOINT;
  if (!endpoint) return;

  const credential = new DefaultAzureCredential();
  const listSettings =
    dependencies.listSettings ??
    (() => new AppConfigurationClient(endpoint, credential).listConfigurationSettings());
  const getSecret =
    dependencies.getSecret ??
    (async (secretUri: string) => {
      const url = new URL(secretUri);
      const secretName = url.pathname.split('/').filter(Boolean)[1];
      if (!secretName) throw new Error(`Invalid Key Vault secret URI: ${secretUri}`);

      const client = new SecretClient(url.origin, credential);
      return client.getSecret(secretName);
    });

  for await (const setting of listSettings()) {
    const environmentKey = environmentKeys[setting.key];
    if (!environmentKey || process.env[environmentKey] !== undefined) continue;

    const value = isKeyVaultReference(setting)
      ? await resolveKeyVaultReference(setting, getSecret)
      : setting.value;

    if (value !== undefined) process.env[environmentKey] = value;
  }
}

function isKeyVaultReference(setting: ConfigurationSetting): boolean {
  return setting.contentType?.toLowerCase().startsWith(keyVaultReferenceContentType) ?? false;
}

async function resolveKeyVaultReference(
  setting: ConfigurationSetting,
  getSecret: (secretUri: string) => Promise<{ value?: string }>,
): Promise<string | undefined> {
  let uri: string | undefined;
  try {
    uri = JSON.parse(setting.value ?? '').uri;
  } catch {
    // The common error below includes the App Configuration key, but never a
    // secret value.
  }

  if (!uri) {
    throw new Error(`Invalid Key Vault reference for ${setting.key}`);
  }

  const secret = await getSecret(uri);
  if (secret.value === undefined) {
    throw new Error(`Key Vault reference has no value for ${setting.key}`);
  }
  return secret.value;
}
