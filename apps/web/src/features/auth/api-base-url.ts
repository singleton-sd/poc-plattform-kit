/**
 * Absolute Nest API origin for browser calls (Option B SSO).
 *
 * SWA Free cannot link `/api` to App Service, so the SPA calls the API host
 * directly with credentials. Cookie Domain is set on the API so
 * `app.` and `api.` under `.plattform-kit.poc.singletonsd.com` share the
 * Auth.js session.
 *
 * Override at build time with `NEXT_PUBLIC_API_BASE_URL` — `preview-web.yml`
 * bakes this to the PR's ACA API preview when one exists, else prod (see
 * docs/sso.md § Preview API target).
 */

/**
 * Runtime path must read `process.env.NEXT_PUBLIC_API_BASE_URL` as a static
 * property access so Next.js can inline it into the client bundle. Optional
 * `env` is for tests only — do not default it to `process.env`.
 */
export function resolveApiBaseUrl(
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>,
): string {
  const raw = (env ? env.NEXT_PUBLIC_API_BASE_URL : process.env.NEXT_PUBLIC_API_BASE_URL)?.trim();
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
