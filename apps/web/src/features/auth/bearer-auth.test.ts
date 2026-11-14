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

  it('logs out via redirect when a user exists', async () => {
    getUser.mockResolvedValue({ access_token: 'tok', expired: false });
    signoutRedirect.mockResolvedValue(undefined);

    await signOutWithBearer();

    expect(signoutRedirect).toHaveBeenCalled();
  });
});
