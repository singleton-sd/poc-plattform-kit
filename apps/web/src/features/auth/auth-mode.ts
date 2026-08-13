/**
 * Auth transport for the SPA.
 *
 * - `cookie` — Option B Auth.js session on custom domains (same-site Lax).
 * - `bearer` — MSAL access token on Azure Static Web Apps and Azure
 *   Container Apps preview hosts (no shared cookie Domain with the API).
 */
export type AuthMode = 'cookie' | 'bearer';

const AZURE_SWA_ROOT = 'azurestaticapps.net';
const AZURE_ACA_ROOT = 'azurecontainerapps.io';

function hostnameMatchesAzureRoot(hostname: string, root: string): boolean {
  const host = hostname.trim().toLowerCase();
  return host === root || host.endsWith(`.${root}`);
}

/** True for default + PR preview SWA hostnames (`*.azurestaticapps.net`). */
export function isAzureStaticAppsHost(hostname: string): boolean {
  return hostnameMatchesAzureRoot(hostname, AZURE_SWA_ROOT);
}

/** True for Azure Container Apps hostnames (`*.azurecontainerapps.io`). */
export function isAzureContainerAppsHost(hostname: string): boolean {
  return hostnameMatchesAzureRoot(hostname, AZURE_ACA_ROOT);
}

/**
 * Resolve auth mode from the browser hostname.
 * Custom domains / localhost stay on cookies; SWA and ACA preview hosts
 * use Bearer.
 */
export function resolveAuthMode(
  hostname: string | undefined = typeof window !== 'undefined'
    ? window.location.hostname
    : undefined,
): AuthMode {
  if (!hostname) {
    return 'cookie';
  }
  return isAzureStaticAppsHost(hostname) || isAzureContainerAppsHost(hostname)
    ? 'bearer'
    : 'cookie';
}
