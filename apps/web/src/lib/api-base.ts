/** Build-time API origin for the static SPA (`preview-web` / `deploy-web` bake this in). */
export function getApiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_BASE_URL ?? '').replace(/\/$/, '');
}

/** Absolute API URL when `NEXT_PUBLIC_API_BASE_URL` is set; otherwise same-origin path. */
export function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const base = getApiBaseUrl();
  return base ? `${base}${normalized}` : normalized;
}
