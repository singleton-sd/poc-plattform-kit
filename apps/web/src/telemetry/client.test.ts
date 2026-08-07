import {
  apiFetch,
  getAppInsights,
  trackClientException,
  trackFailedApiCall,
  type AppInsightsLike,
} from './client';

describe('client telemetry', () => {
  const trackException = jest.fn();
  const trackTrace = jest.fn();

  beforeEach(() => {
    trackException.mockReset();
    trackTrace.mockReset();
    window.appInsights = { trackException, trackTrace };
    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete window.appInsights;
    jest.restoreAllMocks();
    delete (global as { fetch?: typeof fetch }).fetch;
  });

  it('returns the configured Application Insights client', () => {
    expect(getAppInsights()).toBe(window.appInsights);
  });

  it('does nothing when Application Insights is unavailable', () => {
    delete window.appInsights;

    expect(() => trackClientException(new Error('not reported'))).not.toThrow();
  });

  it('reports client exceptions with diagnostic properties', () => {
    const error = new Error('render failed');

    trackClientException(error, { digest: 'digest-1' });

    expect(trackException).toHaveBeenCalledWith({
      exception: error,
      properties: { digest: 'digest-1' },
    });
  });

  it('reports failed API responses with request details', () => {
    const response = createResponse({
      body: 'unavailable',
      status: 503,
      statusText: 'Service Unavailable',
      url: 'https://api.example.test/health',
    });

    trackFailedApiCall(response, 'unavailable');

    expect(trackException).toHaveBeenCalledWith({
      exception: expect.objectContaining({
        message: 'API 503 Service Unavailable https://api.example.test/health',
      }),
      properties: {
        status: '503',
        statusText: 'Service Unavailable',
        url: 'https://api.example.test/health',
      },
    });
    expect(trackTrace).toHaveBeenCalledWith({
      message: 'unavailable',
      severityLevel: 2,
    });
  });

  it('adds a correlation id and reports unsuccessful fetches', async () => {
    const response = createResponse({
      body: 'bad request',
      status: 400,
      statusText: 'Bad Request',
      url: 'https://api.example.test/tenants',
    });
    const fetchMock = jest.mocked(global.fetch).mockResolvedValue(response);

    const result = await apiFetch('https://api.example.test/tenants', {
      correlationId: 'correlation-1',
    });

    expect(result).toBe(response);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/tenants',
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
    const requestInit = fetchMock.mock.calls[0]?.[1];
    expect(new Headers(requestInit?.headers).get('x-correlation-id')).toBe('correlation-1');
    expect(trackException).toHaveBeenCalled();
  });

  it('reports and rethrows fetch errors', async () => {
    const error = new Error('network unavailable');
    jest.mocked(global.fetch).mockRejectedValue(error);

    await expect(apiFetch('/health')).rejects.toBe(error);
    expect(trackException).toHaveBeenCalledWith({ exception: error, properties: undefined });
  });

  it('does not require trace support to report a failed response', () => {
    window.appInsights = { trackException } satisfies AppInsightsLike;

    expect(() => trackFailedApiCall(createResponse({ status: 500 }), 'failure')).not.toThrow();
    expect(trackException).toHaveBeenCalled();
  });
});

function createResponse({
  body = '',
  status,
  statusText = '',
  url = '',
}: {
  body?: string;
  status: number;
  statusText?: string;
  url?: string;
}): Response {
  const response = {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    url,
    clone: () => ({ text: async () => body }),
  };
  return response as unknown as Response;
}
