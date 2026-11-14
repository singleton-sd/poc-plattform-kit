import {
  completeBearerRedirect,
  getBearerAccessToken,
  resetBearerTokenCacheForTests,
  signInWithBearer,
  signOutWithBearer,
} from './bearer-auth';

const signinRedirect = jest.fn();
const signinRedirectCallback = jest.fn();
const getUser = jest.fn();
const signinSilent = jest.fn();
const signoutRedirect = jest.fn();

jest.mock('./oidc-config', () => ({
  resolveOidcPublicConfig: jest.fn(() => ({
    issuer: 'https://auth.example.test/realms/singletonsd',
    clientId: 'platform-kit-web',
    audience: 'platform-kit-api',
  })),
  getOidcUserManager: jest.fn(() => ({
    signinRedirect,
    signinRedirectCallback,
    getUser,
    signinSilent,
    signoutRedirect,
  })),
}));

describe('bearer-auth', () => {
  beforeEach(() => {
    resetBearerTokenCacheForTests();
    signinRedirect.mockReset();
    signinRedirectCallback.mockReset();
    getUser.mockReset();
    signinSilent.mockReset();
    signoutRedirect.mockReset();
  });

  it('starts OIDC redirect sign-in', async () => {
    signinRedirect.mockResolvedValue(undefined);

    await signInWithBearer();

    expect(signinRedirect).toHaveBeenCalled();
  });

  it('completes redirect and caches the access token', async () => {
    signinRedirectCallback.mockResolvedValue({
      access_token: 'redirect-tok',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    });

    await expect(completeBearerRedirect()).resolves.toBe(true);
    await expect(getBearerAccessToken()).resolves.toBe('redirect-tok');
    expect(getUser).not.toHaveBeenCalled();
  });

  it('reads a stored user when there is no redirect callback', async () => {
    signinRedirectCallback.mockRejectedValue(new Error('No state'));
    getUser.mockResolvedValue({
      access_token: 'stored-tok',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      expired: false,
    });

    await expect(completeBearerRedirect()).resolves.toBe(false);
    await expect(getBearerAccessToken()).resolves.toBe('stored-tok');
  });

  it('silently renews an expired stored token', async () => {
    signinRedirectCallback.mockRejectedValue(new Error('No state'));
    getUser.mockResolvedValue({
      access_token: 'expired-tok',
      expires_at: Math.floor(Date.now() / 1000) - 30,
      expired: true,
    });
    signinSilent.mockResolvedValue({
      access_token: 'renewed-tok',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      expired: false,
    });

    await expect(completeBearerRedirect()).resolves.toBe(false);
    await expect(getBearerAccessToken()).resolves.toBe('renewed-tok');
    expect(signinSilent).toHaveBeenCalled();
  });

  it('renews from getBearerAccessToken without priming the cache', async () => {
    getUser.mockResolvedValue({
      access_token: 'expired-tok',
      expires_at: Math.floor(Date.now() / 1000) - 30,
      expired: true,
    });
    signinSilent.mockResolvedValue({
      access_token: 'renewed-tok',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      expired: false,
    });

    await expect(getBearerAccessToken()).resolves.toBe('renewed-tok');
    expect(signinSilent).toHaveBeenCalledTimes(1);
    expect(signinRedirectCallback).not.toHaveBeenCalled();
  });

  it('returns null when silent renewal is rejected', async () => {
    getUser.mockResolvedValue({
      access_token: 'expired-tok',
      expired: true,
    });
    signinSilent.mockRejectedValue(new Error('refresh token revoked'));

    await expect(getBearerAccessToken()).resolves.toBeNull();
  });

  it('returns null when no stored user exists', async () => {
    getUser.mockResolvedValue(null);
    signinSilent.mockResolvedValue(null);

    await expect(getBearerAccessToken()).resolves.toBeNull();
  });

  it('shares one silent renewal across overlapping callers', async () => {
    getUser.mockResolvedValue({
      access_token: 'expired-tok',
      expired: true,
    });
    let resolveSilent: (user: {
      access_token: string;
      expires_at: number;
      expired: boolean;
    }) => void = () => undefined;
    signinSilent.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSilent = resolve;
        }),
    );

    const first = getBearerAccessToken();
    const second = getBearerAccessToken();
    await Promise.resolve();
    await Promise.resolve();

    expect(signinSilent).toHaveBeenCalledTimes(1);
    resolveSilent({
      access_token: 'renewed-tok',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      expired: false,
    });
    await expect(first).resolves.toBe('renewed-tok');
    await expect(second).resolves.toBe('renewed-tok');
    expect(signinSilent).toHaveBeenCalledTimes(1);
  });

  it('logs out via redirect when a user exists', async () => {
    getUser.mockResolvedValue({ access_token: 'tok', expired: false });
    signoutRedirect.mockResolvedValue(undefined);

    await signOutWithBearer();

    expect(signoutRedirect).toHaveBeenCalled();
  });
});
