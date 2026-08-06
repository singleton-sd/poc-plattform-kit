/**
 * Absolute Nest API origin for browser calls (Option B SSO).
 *
 * SWA Free cannot link `/api` to App Service, so the SPA calls the API host
 * directly with credentials. Cookie Domain is set on the API so
 * `app.` and `api.` under `.plattform-kit.poc.singletonsd.com` share the
 * Auth.js session.
 *
 * Override at build time with `NEXT_PUBLIC_API_BASE_URL` (SWA previews will
 * point at prod or ACA — see preview follow-up tickets).
 */
export function resolveApiBaseUrl(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): string {
  const raw = env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (!raw) {
    return '';
  }
  return raw.replace(/\/+$/, '');
}

export function apiUrl(
  path: string,
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>,
): string {
  const base = resolveApiBaseUrl(env);
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${normalized}` : normalized;
}
