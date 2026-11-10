/**
 * Prefix a site-relative path with Astro `base` so the same source works at
 * `/` (production GitHub Pages) and `/pr-preview/pr-<n>/` (PR previews).
 *
 * @param {string} [base]
 * @returns {string}
 */
export function normalizeBase(base) {
  const value = base && base.length > 0 ? base : '/';
  return value.endsWith('/') ? value : `${value}/`;
}

/**
 * @returns {string}
 */
function readEnvBase() {
  const env = import.meta.env;
  if (env && typeof env.BASE_URL === 'string' && env.BASE_URL.length > 0) {
    return env.BASE_URL;
  }
  if (typeof process !== 'undefined' && process.env?.PREVIEW_BASE_PATH) {
    return process.env.PREVIEW_BASE_PATH;
  }
  return '/';
}

/**
 * @param {string} path
 * @returns {boolean}
 */
export function isAbsoluteUrl(path) {
  return /^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(path) || /^(?:mailto|tel):/i.test(path);
}

/**
 * @param {string} path
 * @param {string} [base]
 * @returns {string}
 */
export function withBase(path, base) {
  if (typeof path !== 'string' || path.length === 0) {
    return normalizeBase(base ?? readEnvBase());
  }
  if (isAbsoluteUrl(path) || path.startsWith('#')) {
    return path;
  }
  const resolvedBase = normalizeBase(base ?? readEnvBase());
  const trimmed = path.replace(/^\/+/u, '');
  return trimmed ? `${resolvedBase}${trimmed}` : resolvedBase;
}

/**
 * Strip Astro `base` from a pathname so nav matching can use root-relative
 * hrefs like `/features` on both production and PR previews.
 *
 * @param {string} pathname
 * @param {string} [base]
 * @returns {string}
 */
export function stripBase(pathname, base) {
  const resolvedBase = normalizeBase(base ?? readEnvBase()).replace(/\/$/u, '');
  let path = pathname || '/';
  if (resolvedBase && path.startsWith(resolvedBase)) {
    path = path.slice(resolvedBase.length);
  }
  path = path.replace(/\/+$/u, '');
  return path || '/';
}
