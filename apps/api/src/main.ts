import { loadAppConfiguration } from './config/app-configuration';
import { loadKeycloakClientSecretFromKeyVault } from './config/keycloak-client-secret-key-vault';

async function main() {
  await loadAppConfiguration();
  await loadKeycloakClientSecretFromKeyVault();
  await import('./telemetry');
  const { bootstrap } = await import('./bootstrap');
  await bootstrap();
}

void main();
