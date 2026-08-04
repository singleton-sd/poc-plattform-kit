/**
 * Shared helpers for reporting client errors once Next.js lands.
 * The static stub uses telemetry.js; this module is the package entry for
 * future React/Next imports.
 */

/** @typedef {{ trackException: (payload: { exception: Error }) => void, trackTrace?: (payload: { message: string, severityLevel?: number }) => void }} AppInsightsLike */

/**
 * @returns {AppInsightsLike | null}
 */
export function getAppInsights() {
  if (typeof window === 'undefined') return null;
  return window.appInsights ?? null;
}

/**
 * @param {Error} error
 * @param {Record<string, string>=} properties
 */
export function trackClientException(error, properties) {
  const ai = getAppInsights();
  if (!ai) return;
  ai.trackException({ exception: error });
  if (properties && ai.trackTrace) {
    ai.trackTrace({
      message: `client-exception:${error.message}`,
      severityLevel: 3,
    });
  }
}

/**
 * Report a failed API response (non-OK).
 * @param {Response} response
 * @param {string=} bodySnippet
 */
export function trackFailedApiCall(response, bodySnippet) {
  const ai = getAppInsights();
  if (!ai) return;
  const err = new Error(
    `API ${response.status} ${response.statusText} ${response.url}`,
  );
  ai.trackException({ exception: err });
  if (ai.trackTrace && bodySnippet) {
    ai.trackTrace({
      message: bodySnippet.slice(0, 500),
      severityLevel: 2,
    });
  }
}

/**
 * Fetch wrapper that tracks non-OK responses and network failures.
 * Propagates x-correlation-id when provided.
 * @param {RequestInfo | URL} input
 * @param {RequestInit & { correlationId?: string }=} init
 */
export async function apiFetch(input, init = {}) {
  const headers = new Headers(init.headers || {});
  if (init.correlationId) {
    headers.set('x-correlation-id', init.correlationId);
  }
  try {
    const response = await fetch(input, { ...init, headers });
    if (!response.ok) {
      let snippet = '';
      try {
        snippet = await response.clone().text();
      } catch {
        /* ignore */
      }
      trackFailedApiCall(response, snippet);
    }
    return response;
  } catch (err) {
    trackClientException(err instanceof Error ? err : new Error(String(err)));
    throw err;
  }
}
