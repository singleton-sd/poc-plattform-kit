import { csrfUrl, ENTRA_PROVIDER_ID, signInUrl, signOut, signOutUrl } from './auth-urls';

describe('auth-urls', () => {
  const previousBase = process.env.NEXT_PUBLIC_API_BASE_URL;

  afterEach(() => {
    if (previousBase === undefined) {
      delete process.env.NEXT_PUBLIC_API_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_API_BASE_URL = previousBase;
    }
  });

  it('builds the Entra Auth.js sign-in URL with callbackUrl (same-origin)', () => {
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    expect(signInUrl('/support')).toBe(
      `/api/auth/signin/${ENTRA_PROVIDER_ID}?callbackUrl=${encodeURIComponent('/support')}`,
    );
  });

  it('prefixes sign-in with NEXT_PUBLIC_API_BASE_URL', () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.example.test';
    expect(signInUrl('https://app.example.test/')).toBe(
      `https://api.example.test/api/auth/signin/${ENTRA_PROVIDER_ID}?callbackUrl=${encodeURIComponent('https://app.example.test/')}`,
    );
  });

  it('defaults callbackUrl to the current origin when window is available', () => {
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    const expected = encodeURIComponent(`${window.location.origin}/`);
    expect(signInUrl()).toBe(`/api/auth/signin/${ENTRA_PROVIDER_ID}?callbackUrl=${expected}`);
  });

  it('signs out with CSRF then POST against the API base', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.example.test';
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ csrfToken: 'csrf-test' }),
      })
      .mockResolvedValueOnce({ ok: true });

    global.fetch = fetchMock as unknown as typeof fetch;

    await signOut('https://app.example.test/');

    expect(fetchMock).toHaveBeenNthCalledWith(1, csrfUrl(), { credentials: 'include' });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      signOutUrl(),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      }),
    );
    const body = (fetchMock.mock.calls[1][1] as RequestInit).body as URLSearchParams;
    expect(body.get('csrfToken')).toBe('csrf-test');
    expect(body.get('callbackUrl')).toBe('https://app.example.test/');
  });
});
