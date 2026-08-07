import { getBearerAccessToken, signInWithBearer, signOutWithBearer } from './bearer-auth';

const setActiveAccount = jest.fn();
const getActiveAccount = jest.fn();
const getAllAccounts = jest.fn();
const acquireTokenSilent = jest.fn();
const loginPopup = jest.fn();
const logoutPopup = jest.fn();

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
    loginPopup,
    logoutPopup,
  })),
}));

describe('bearer-auth', () => {
  beforeEach(() => {
    setActiveAccount.mockReset();
    getActiveAccount.mockReset();
    getAllAccounts.mockReset();
    acquireTokenSilent.mockReset();
    loginPopup.mockReset();
    logoutPopup.mockReset();
  });

  it('sets the active account from loginPopup', async () => {
    const account = { homeAccountId: 'a1' };
    loginPopup.mockResolvedValue({ account });

    await signInWithBearer();

    expect(loginPopup).toHaveBeenCalledWith({ scopes: ['api://client-1/.default'] });
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

  it('logs out the active account and clears it', async () => {
    const account = { homeAccountId: 'active' };
    getActiveAccount.mockReturnValue(account);
    logoutPopup.mockResolvedValue(undefined);

    await signOutWithBearer();

    expect(logoutPopup).toHaveBeenCalledWith({ account });
    expect(setActiveAccount).toHaveBeenCalledWith(null);
  });
});
