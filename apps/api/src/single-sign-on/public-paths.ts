/**
 * Paths that must stay reachable without Nest auth guards.
 * Auth.js `/api/auth/*` and Swagger are also mounted outside Nest controllers;
 * listed here for defense-in-depth if a Nest route overlaps.
 */
export function isPublicPath(path: string): boolean {
  const normalized = path.split('?')[0] || '/';
  if (normalized === '/health' || normalized.startsWith('/health/')) {
    return true;
  }
  if (normalized === '/api/auth' || normalized.startsWith('/api/auth/')) {
    return true;
  }
  if (normalized === '/docs' || normalized.startsWith('/docs/') || normalized === '/docs-json') {
    return true;
  }
  return false;
}
