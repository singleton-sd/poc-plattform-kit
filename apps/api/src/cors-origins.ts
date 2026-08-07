/**
 * Default browser origins allowed to call the API.
 * SWA entries are instance-scoped (`{swaName}*.azurestaticapps.net`) so PR
 * preview hosts of *this* SWA match, not every Azure customer's Static Web App.
 */
export const DEFAULT_CORS_ORIGINS = [
  'https://app.plattform-kit.poc.singletonsd.com',
  'https://plattform-kit.poc.singletonsd.com',
  'https://kind-rock-0f409fe00*.azurestaticapps.net',
  'https://purple-field-05048bf00*.azurestaticapps.net',
] as const;

/** Host-suffix wildcard: `https://*.example.com` (https only). */
const HOST_SUFFIX_WILDCARD = /^https:\/\/\*\.([A-Za-z0-9.-]+)$/;

/**
 * SWA instance prefix: `https://kind-rock-0f409fe00*.azurestaticapps.net`
 * Matches default host (`name.…azurestaticapps.net`) and PR hosts (`name-57.…`).
 */
const SWA_INSTANCE_WILDCARD = /^https:\/\/([A-Za-z0-9-]+)\*\.azurestaticapps\.net$/i;

const AZURE_SWA_ROOT = 'azurestaticapps.net';

/**
 * Parse CORS_ORIGINS env (comma-separated). Empty / whitespace → defaults.
 * Entries may be exact origins, `https://*.domain` suffixes, or
 * `https://{swaName}*.azurestaticapps.net` instance prefixes.
 */
export function parseCorsOrigins(raw: string | undefined): string[] {
  if (raw === undefined || raw.trim() === '') {
    return [...DEFAULT_CORS_ORIGINS];
  }
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return parts.length > 0 ? parts : [...DEFAULT_CORS_ORIGINS];
}

function httpsHostname(origin: string): string | undefined {
  try {
    const url = new URL(origin);
    if (url.protocol !== 'https:') {
      return undefined;
    }
    return url.hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

function matchesSwaInstance(hostname: string, swaName: string): boolean {
  if (!hostname.endsWith(`.${AZURE_SWA_ROOT}`)) {
    return false;
  }
  return hostname.startsWith(`${swaName}.`) || hostname.startsWith(`${swaName}-`);
}

function matchesAllowlistEntry(
  origin: string,
  entry: string,
  options: { allowOpenAzureSwaSuffix: boolean },
): boolean {
  if (entry === origin) {
    return true;
  }

  const swa = SWA_INSTANCE_WILDCARD.exec(entry);
  if (swa) {
    const hostname = httpsHostname(origin);
    return hostname !== undefined && matchesSwaInstance(hostname, swa[1].toLowerCase());
  }

  const suffixWild = HOST_SUFFIX_WILDCARD.exec(entry);
  if (!suffixWild) {
    return false;
  }

  const suffix = suffixWild[1].toLowerCase();
  if (!options.allowOpenAzureSwaSuffix && suffix === AZURE_SWA_ROOT) {
    // Multi-tenant SWA root is too broad for Auth.js redirects (open redirect).
    return false;
  }

  const hostname = httpsHostname(origin);
  if (!hostname) {
    return false;
  }
  return hostname === suffix || hostname.endsWith(`.${suffix}`);
}

/** True when `origin` matches an exact entry or an allowed wildcard (CORS). */
export function isCorsOriginAllowed(origin: string, allowlist: readonly string[]): boolean {
  return allowlist.some((entry) =>
    matchesAllowlistEntry(origin, entry, { allowOpenAzureSwaSuffix: true }),
  );
}

/**
 * Auth.js post-login redirect allowlist: exact origins + this-repo SWA instance
 * prefixes only. Ignores open `https://*.azurestaticapps.net` (any tenant).
 */
export function isAuthRedirectOriginAllowed(origin: string, allowlist: readonly string[]): boolean {
  return allowlist.some((entry) =>
    matchesAllowlistEntry(origin, entry, { allowOpenAzureSwaSuffix: false }),
  );
}

/**
 * Nest `enableCors({ origin })` delegate: reflect allowed Origin, deny others.
 * Requests with no Origin (non-browser) are allowed.
 */
export function resolveCorsOrigin(
  requestOrigin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
  rawEnv: string | undefined = process.env.CORS_ORIGINS,
): void {
  if (!requestOrigin) {
    callback(null, true);
    return;
  }
  callback(null, isCorsOriginAllowed(requestOrigin, parseCorsOrigins(rawEnv)));
}
