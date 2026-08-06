import { CSRF_URL, ENTRA_PROVIDER_ID, SIGN_OUT_URL, signInUrl, signOut } from './auth-urls';

describe('auth-urls', () => {
  it('builds the Entra Auth.js sign-in URL with callbackUrl', () => {
    expect(signInUrl('/support')).toBe(
      `/api/auth/signin/${ENTRA_PROVIDER_ID}?callbackUrl=${encodeURIComponent('/support')}`,
    );
  });

  it('defaults callbackUrl to /', () => {
    expect(signInUrl()).toBe(`/api/auth/signin/${ENTRA_PROVIDER_ID}?callbackUrl=%2F`);
  });

  it('signs out with CSRF then POST', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ csrfToken: 'csrf-test' }),
      })
      .mockResolvedValueOnce({ ok: true });

    global.fetch = fetchMock as unknown as typeof fetch;

    await signOut('/');

    expect(fetchMock).toHaveBeenNthCalledWith(1, CSRF_URL, { credentials: 'include' });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      SIGN_OUT_URL,
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      }),
    );
    const body = (fetchMock.mock.calls[1][1] as RequestInit).body as URLSearchParams;
    expect(body.get('csrfToken')).toBe('csrf-test');
    expect(body.get('callbackUrl')).toBe('/');
  });
});
