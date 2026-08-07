import type { AccountInfo, SilentRequest } from '@azure/msal-browser';
import { InteractionRequiredAuthError } from '@azure/msal-browser';

import { getMsalPublicClient, resolveMsalPublicConfig } from './msal-config';

function loginRequestScopes(): string[] {
  const config = resolveMsalPublicConfig();
  if (!config) {
    throw new Error(
      'MSAL is not configured (set NEXT_PUBLIC_AZURE_AD_CLIENT_ID and NEXT_PUBLIC_AZURE_AD_TENANT_ID)',
    );
  }
  return [config.apiScope];
}

/** Prefer the active account from the last interactive login. */
function resolveAccount(app: Awaited<ReturnType<typeof getMsalPublicClient>>): AccountInfo | null {
  return app.getActiveAccount() ?? app.getAllAccounts()[0] ?? null;
}

/**
 * Silent access-token acquire for Nest Bearer auth.
 * Returns null when signed out or MSAL is not configured (no interactive prompt).
 */
export async function getBearerAccessToken(): Promise<string | null> {
  if (!resolveMsalPublicConfig()) {
    return null;
  }

  const app = await getMsalPublicClient();
  const account = resolveAccount(app);
  if (!account) {
    return null;
  }

  const request: SilentRequest = {
    account,
    scopes: loginRequestScopes(),
  };

  try {
    const result = await app.acquireTokenSilent(request);
    return result.accessToken || null;
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      return null;
    }
    throw error;
  }
}

/** Interactive MSAL popup sign-in for SWA preview hosts. */
export async function signInWithBearer(): Promise<void> {
  const app = await getMsalPublicClient();
  const result = await app.loginPopup({
    scopes: loginRequestScopes(),
  });
  if (result.account) {
    app.setActiveAccount(result.account);
  }
}

/** Clear MSAL session (popup logout when an account exists). */
export async function signOutWithBearer(): Promise<void> {
  if (!resolveMsalPublicConfig()) {
    return;
  }

  const app = await getMsalPublicClient();
  const account = resolveAccount(app);
  if (!account) {
    return;
  }

  await app.logoutPopup({ account });
  app.setActiveAccount(null);
}
