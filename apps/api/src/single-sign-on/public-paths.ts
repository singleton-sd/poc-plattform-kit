/**
 * Paths that must stay reachable without Nest auth guards.
 * Auth.js `/api/auth/*` and Swagger are also mounted outside Nest controllers;
 * listed here for defense-in-depth if a Nest route overlaps.
 */
export function isPublicPath(path: string): boolean {
  const normalized = (path.split('?')[0] ?? '').trim();
  // Empty/unknown path must not be treated as `/` (would open SessionOrJwtAuthGuard).
  if (!normalized) {
    return false;
  }
  if (normalized === '/') {
    return true;
  }
  if (normalized === '/health' || normalized.startsWith('/health/')) {
    return true;
  }
  if (normalized === '/api/auth' || normalized.startsWith('/api/auth/')) {
    return true;
  }
  if (normalized === '/docs' || normalized.startsWith('/docs/') || normalized === '/docs-json') {
    return true;
  }
  // Swagger UI default when mounted at `/docs` (no trailing slash).
  if (normalized === '/oauth2-redirect.html') {
    return true;
  }
  return false;
}
