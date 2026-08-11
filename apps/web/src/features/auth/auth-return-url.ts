// Utilities for capturing and restoring a one-time return URL during auth redirect flows.
const RETURN_TO_KEY = 'pocpk:returnTo';

/** Capture current location (pathname + search + hash) to sessionStorage for later restoration. */
export function captureReturnUrl(): void {
  if (typeof window === 'undefined') return;
  try {
    const value = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    sessionStorage.setItem(RETURN_TO_KEY, value);
  } catch {
    // Ignore storage errors silently (private mode, etc.)
  }
}

/** Validate a candidate return URL and normalize it to a safe path (same-origin only). */
export function sanitizeReturnUrl(candidate: string | null | undefined): string | null {
  if (!candidate) return null;
  if (typeof window === 'undefined') return null;

  const trimmed = candidate.trim();
  // Reject protocol-relative URLs ("//example.com") which are effectively external.
  if (trimmed.startsWith('//')) return null;

  // Absolute URL handling: allow only same-origin
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const u = new URL(trimmed);
      if (u.origin === window.location.origin) {
        return `${u.pathname}${u.search}${u.hash}` || '/';
      }
      return null;
    } catch {
      return null;
    }
  }

  // Relative path must start with '/'
  if (trimmed.startsWith('/')) {
    // disallow javascript: and other schemes disguised as path
    if (trimmed.toLowerCase().startsWith('/javascript:')) return null;
    return trimmed || '/';
  }

  return null;
}

/** Atomically read and clear the stored return URL, returning a sanitized path or null. */
export function getAndClearReturnUrl(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(RETURN_TO_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(RETURN_TO_KEY);
    return sanitizeReturnUrl(raw);
  } catch {
    return null;
  }
}
