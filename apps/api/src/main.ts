import { loadAppConfiguration } from './config/app-configuration';

async function main() {
  await loadAppConfiguration();
  await import('./telemetry');
  const { bootstrap } = await import('./bootstrap');
  await bootstrap();
}

void main();
