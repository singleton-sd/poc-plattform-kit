/** Origins the public Playwright suite may contact (app under test + loopback). */

export function resolvePlaywrightBaseUrl(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): string {
  const configured = env.PLAYWRIGHT_BASE_URL?.trim().replace(/\/$/, '');
  return configured || 'http://127.0.0.1:4173';
}

export function collectAllowedOrigins(baseUrl: string): string[] {
  const origins = new Set<string>(['http://127.0.0.1:4173', 'http://localhost:4173']);

  try {
    origins.add(new URL(baseUrl).origin);
  } catch {
    // Invalid base URLs stay limited to the loopback defaults above.
  }

  return [...origins];
}

export function isAllowedPlaywrightRequestUrl(
  requestUrl: string,
  allowedOrigins: readonly string[],
): boolean {
  let url: URL;
  try {
    url = new URL(requestUrl);
  } catch {
    return false;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return true;
  }

  if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
    return true;
  }

  return allowedOrigins.includes(url.origin);
}
