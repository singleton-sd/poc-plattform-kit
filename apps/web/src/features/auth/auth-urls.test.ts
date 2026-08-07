import { csrfUrl, ENTRA_PROVIDER_ID, signIn, signInUrl, signOut, signOutUrl } from './auth-urls';

describe('auth-urls', () => {
  const previousBase = process.env.NEXT_PUBLIC_API_BASE_URL;

  afterEach(() => {
    if (previousBase === undefined) {
      delete process.env.NEXT_PUBLIC_API_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_API_BASE_URL = previousBase;
    }
    jest.restoreAllMocks();
  });

  it('builds the Entra Auth.js sign-in URL (same-origin)', () => {
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    expect(signInUrl()).toBe(`/api/auth/signin/${ENTRA_PROVIDER_ID}`);
  });

  it('prefixes sign-in with NEXT_PUBLIC_API_BASE_URL', () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.example.test';
    expect(signInUrl()).toBe(`https://api.example.test/api/auth/signin/${ENTRA_PROVIDER_ID}`);
  });

  it('starts sign-in with CSRF then form POST', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.example.test';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ csrfToken: 'csrf-test' }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const appendChild = jest.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
    const submit = jest.fn();
    jest.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      if (tag === 'form') {
        return {
          method: '',
          action: '',
          style: { display: '' },
          appendChild: jest.fn(),
          submit,
        } as unknown as HTMLFormElement;
      }
      return {
        type: '',
        name: '',
        value: '',
      } as unknown as HTMLInputElement;
    }) as typeof document.createElement);

    await signIn('https://app.example.test/');

    expect(fetchMock).toHaveBeenCalledWith(csrfUrl(), { credentials: 'include' });
    expect(submit).toHaveBeenCalled();
    expect(appendChild).toHaveBeenCalled();
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
