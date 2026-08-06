import { fetchMe } from './me';

function mockFetch(response: Partial<Response> & { json?: jest.Mock }) {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: new Headers(),
    json: jest.fn(),
    ...response,
  });
  // jsdom does not always define fetch; assign rather than spyOn.
  (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch =
    fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe('fetchMe', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    (globalThis as typeof globalThis & { fetch?: typeof fetch }).fetch = originalFetch;
  });

  it('returns null when the response is not ok', async () => {
    mockFetch({
      ok: false,
      status: 404,
      headers: new Headers({ 'content-type': 'text/plain' }),
      json: jest.fn(),
    });

    await expect(fetchMe()).resolves.toBeNull();
  });

  it('returns null when SWA serves HTML instead of JSON', async () => {
    const json = jest.fn().mockRejectedValue(new SyntaxError('Unexpected token <'));
    mockFetch({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/html' }),
      json,
    });

    await expect(fetchMe()).resolves.toBeNull();
    expect(json).not.toHaveBeenCalled();
  });

  it('returns the session payload for a JSON response', async () => {
    const me = {
      id: '1',
      email: 'agent@example.com',
      name: 'Agent',
      role: 'support-agent',
    };
    const fetchMock = mockFetch({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: jest.fn().mockResolvedValue(me),
    });

    await expect(fetchMe()).resolves.toEqual(me);
    expect(fetchMock).toHaveBeenCalledWith('/api/me', { credentials: 'include' });
  });

  it('calls NEXT_PUBLIC_API_BASE_URL + /api/me when set', async () => {
    const previous = process.env.NEXT_PUBLIC_API_BASE_URL;
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.example.test';
    const fetchMock = mockFetch({
      ok: false,
      status: 401,
      headers: new Headers(),
      json: jest.fn(),
    });

    await expect(fetchMe()).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledWith('https://api.example.test/api/me', {
      credentials: 'include',
    });

    if (previous === undefined) {
      delete process.env.NEXT_PUBLIC_API_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_API_BASE_URL = previous;
    }
  });
});
