import {
  completeBearerRedirect,
  getBearerAccessToken,
  signInWithBearer,
  signOutWithBearer,
} from './bearer-auth';

const setActiveAccount = jest.fn();
const getActiveAccount = jest.fn();
const getAllAccounts = jest.fn();
const acquireTokenSilent = jest.fn();
const loginRedirect = jest.fn();
const logoutRedirect = jest.fn();
const handleRedirectPromise = jest.fn();

jest.mock('./msal-config', () => ({
  resolveMsalPublicConfig: jest.fn(() => ({
    clientId: 'client-1',
    tenantId: 'tenant-1',
    apiScope: 'api://client-1/.default',
  })),
  getMsalPublicClient: jest.fn(async () => ({
    setActiveAccount,
    getActiveAccount,
    getAllAccounts,
    acquireTokenSilent,
    loginRedirect,
    logoutRedirect,
    handleRedirectPromise,
  })),
}));

describe('bearer-auth', () => {
  beforeEach(() => {
    setActiveAccount.mockReset();
    getActiveAccount.mockReset();
    getAllAccounts.mockReset();
    acquireTokenSilent.mockReset();
    loginRedirect.mockReset();
    logoutRedirect.mockReset();
    handleRedirectPromise.mockReset();
  });

  it('starts MSAL redirect sign-in', async () => {
    loginRedirect.mockResolvedValue(undefined);

    await signInWithBearer();

    expect(loginRedirect).toHaveBeenCalledWith({ scopes: ['api://client-1/.default'] });
  });

  it('completes redirect and sets the active account', async () => {
    const account = { homeAccountId: 'a1' };
    handleRedirectPromise.mockResolvedValue({ account });

    await expect(completeBearerRedirect()).resolves.toBe(true);
    expect(setActiveAccount).toHaveBeenCalledWith(account);
  });

  it('acquires tokens for the active account', async () => {
    const account = { homeAccountId: 'active' };
    getActiveAccount.mockReturnValue(account);
    getAllAccounts.mockReturnValue([{ homeAccountId: 'other' }]);
    acquireTokenSilent.mockResolvedValue({ accessToken: 'tok' });

    await expect(getBearerAccessToken()).resolves.toBe('tok');
    expect(acquireTokenSilent).toHaveBeenCalledWith({
      account,
      scopes: ['api://client-1/.default'],
    });
  });

  it('logs out via redirect and clears the active account first', async () => {
    const account = { homeAccountId: 'active' };
    getActiveAccount.mockReturnValue(account);
    logoutRedirect.mockResolvedValue(undefined);

    await signOutWithBearer();

    expect(setActiveAccount).toHaveBeenCalledWith(null);
    expect(logoutRedirect).toHaveBeenCalledWith({ account });
  });
});
