/** Default browser origins allowed to call the API (custom domains). */
export const DEFAULT_CORS_ORIGINS = [
  'https://app.plattform-kit.poc.singletonsd.com',
  'https://plattform-kit.poc.singletonsd.com',
] as const;

/**
 * Parse CORS_ORIGINS env (comma-separated). Empty / whitespace → defaults.
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
