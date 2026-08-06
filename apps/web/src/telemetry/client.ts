export type AppInsightsLike = {
  trackException: (payload: { exception: Error; properties?: Record<string, string> }) => void;
  trackTrace?: (payload: { message: string; severityLevel?: number }) => void;
};

export function getAppInsights(): AppInsightsLike | null {
  if (typeof window === 'undefined') return null;
  return window.appInsights ?? null;
}

export function trackClientException(error: Error, properties?: Record<string, string>): void {
  const ai = getAppInsights();
  if (!ai) return;
  ai.trackException({ exception: error, properties });
}

export function trackFailedApiCall(response: Response, bodySnippet?: string): void {
  const ai = getAppInsights();
  if (!ai) return;
  const err = new Error(`API ${response.status} ${response.statusText} ${response.url}`);
  ai.trackException({ exception: err });
  if (ai.trackTrace && bodySnippet) {
    ai.trackTrace({
      message: bodySnippet.slice(0, 500),
      severityLevel: 2,
    });
  }
}

export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit & { correlationId?: string } = {},
): Promise<Response> {
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
