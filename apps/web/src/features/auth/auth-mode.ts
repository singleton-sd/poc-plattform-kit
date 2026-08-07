/**
 * Auth transport for the SPA.
 *
 * - `cookie` — Option B Auth.js session on custom domains (same-site Lax).
 * - `bearer` — MSAL access token on Azure Static Web Apps hosts (no shared
 *   cookie Domain with the API).
 */
export type AuthMode = 'cookie' | 'bearer';

const AZURE_SWA_ROOT = 'azurestaticapps.net';

/** True for default + PR preview SWA hostnames (`*.azurestaticapps.net`). */
export function isAzureStaticAppsHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase();
  return host === AZURE_SWA_ROOT || host.endsWith(`.${AZURE_SWA_ROOT}`);
}

/**
 * Resolve auth mode from the browser hostname.
 * Custom domains / localhost stay on cookies; SWA Free/PR hosts use Bearer.
 */
export function resolveAuthMode(
  hostname: string | undefined = typeof window !== 'undefined'
    ? window.location.hostname
    : undefined,
): AuthMode {
  if (!hostname) {
    return 'cookie';
  }
  return isAzureStaticAppsHost(hostname) ? 'bearer' : 'cookie';
}
