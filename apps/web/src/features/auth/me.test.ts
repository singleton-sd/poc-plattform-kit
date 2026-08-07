import { fetchMe } from './me';

jest.mock('./auth-urls', () => {
  const actual = jest.requireActual('./auth-urls') as typeof import('./auth-urls');
  return {
    ...actual,
    authHeaders: jest.fn(async () => ({})),
  };
});

import { authHeaders } from './auth-urls';

const authHeadersMock = authHeaders as jest.MockedFunction<typeof authHeaders>;

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
    authHeadersMock.mockReset();
    authHeadersMock.mockResolvedValue({});
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
    expect(fetchMock).toHaveBeenCalledWith('/api/me', {
      credentials: 'include',
      headers: {},
    });
  });

  it('uses NEXT_PUBLIC_API_BASE_URL when set', async () => {
    const previous = process.env.NEXT_PUBLIC_API_BASE_URL;
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.plattform-kit.poc.singletonsd.com';
    const fetchMock = mockFetch({
      ok: false,
      status: 401,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: jest.fn(),
    });

    try {
      await expect(fetchMe()).resolves.toBeNull();
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.plattform-kit.poc.singletonsd.com/api/me',
        { credentials: 'include', headers: {} },
      );
    } finally {
      if (previous === undefined) {
        delete process.env.NEXT_PUBLIC_API_BASE_URL;
      } else {
        process.env.NEXT_PUBLIC_API_BASE_URL = previous;
      }
    }
  });

  it('forwards Bearer auth headers when present', async () => {
    authHeadersMock.mockResolvedValue({ Authorization: 'Bearer tok' });
    const fetchMock = mockFetch({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: jest.fn().mockResolvedValue({
        id: '1',
        email: 'a@b.co',
        name: null,
        role: null,
      }),
    });

    await fetchMe();

    expect(fetchMock).toHaveBeenCalledWith('/api/me', {
      credentials: 'include',
      headers: { Authorization: 'Bearer tok' },
    });
  });
});
