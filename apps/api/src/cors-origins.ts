/**
 * Default browser origins allowed to call the API.
 * `https://*.azurestaticapps.net` covers SWA Free default + PR preview hosts.
 */
export const DEFAULT_CORS_ORIGINS = [
  'https://app.plattform-kit.poc.singletonsd.com',
  'https://plattform-kit.poc.singletonsd.com',
  'https://*.azurestaticapps.net',
] as const;

/** Host-suffix wildcard entry: `https://*.example.com` (https only). */
const HOST_WILDCARD = /^https:\/\/\*\.([A-Za-z0-9.-]+)$/;

/**
 * Parse CORS_ORIGINS env (comma-separated). Empty / whitespace → defaults.
 * Entries may be exact origins or `https://*.domain` host wildcards.
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

/** True when `origin` matches an exact entry or an allowed host-suffix wildcard. */
export function isCorsOriginAllowed(origin: string, allowlist: readonly string[]): boolean {
  for (const entry of allowlist) {
    if (entry === origin) {
      return true;
    }
    const wildcard = HOST_WILDCARD.exec(entry);
    if (!wildcard) {
      continue;
    }
    let hostname: string;
    try {
      const url = new URL(origin);
      if (url.protocol !== 'https:') {
        continue;
      }
      hostname = url.hostname.toLowerCase();
    } catch {
      continue;
    }
    const suffix = wildcard[1].toLowerCase();
    if (hostname === suffix || hostname.endsWith(`.${suffix}`)) {
      return true;
    }
  }
  return false;
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
