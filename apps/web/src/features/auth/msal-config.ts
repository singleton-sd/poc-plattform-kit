import type { Configuration } from '@azure/msal-browser';
import { LogLevel, PublicClientApplication } from '@azure/msal-browser';

export type MsalPublicConfig = {
  clientId: string;
  tenantId: string;
  /** Entra scope for the Nest API audience (e.g. `api://{clientId}/.default`). */
  apiScope: string;
};

type EnvBag = NodeJS.ProcessEnv | Record<string, string | undefined>;

/**
 * Read public Entra IDs for MSAL.
 *
 * Runtime (no `env` arg) uses static `process.env.NEXT_PUBLIC_*` reads so Next
 * can inline them into the client bundle. Tests pass an explicit `env` bag.
 */
export function resolveMsalPublicConfig(env?: EnvBag): MsalPublicConfig | null {
  const clientId = (
    env ? env.NEXT_PUBLIC_AZURE_AD_CLIENT_ID : process.env.NEXT_PUBLIC_AZURE_AD_CLIENT_ID
  )?.trim();
  const tenantId = (
    env ? env.NEXT_PUBLIC_AZURE_AD_TENANT_ID : process.env.NEXT_PUBLIC_AZURE_AD_TENANT_ID
  )?.trim();
  const explicitScope = (
    env ? env.NEXT_PUBLIC_AZURE_AD_API_SCOPE : process.env.NEXT_PUBLIC_AZURE_AD_API_SCOPE
  )?.trim();

  if (!clientId || !tenantId) {
    return null;
  }

  return {
    clientId,
    tenantId,
    // Entra custom API scopes use Application ID URI (`api://…/.default`).
    // Nest `AZURE_AD_API_AUDIENCE` should match that URI (not bare client id).
    apiScope: explicitScope || `api://${clientId}/.default`,
  };
}

/** Build MSAL browser configuration for the current SPA origin. */
export function buildMsalConfiguration(
  publicConfig: MsalPublicConfig,
  redirectUri: string,
): Configuration {
  return {
    auth: {
      clientId: publicConfig.clientId,
      authority: `https://login.microsoftonline.com/${publicConfig.tenantId}`,
      redirectUri,
      postLogoutRedirectUri: redirectUri,
      navigateToLoginRequestUrl: false,
    },
    cache: {
      cacheLocation: 'sessionStorage',
      storeAuthStateInCookie: false,
    },
    system: {
      loggerOptions: {
        logLevel: LogLevel.Warning,
      },
    },
  };
}

let pca: PublicClientApplication | null = null;
let pcaInit: Promise<PublicClientApplication> | null = null;

/** Singleton MSAL public client for the SPA (browser only). */
export async function getMsalPublicClient(
  redirectUri: string = typeof window !== 'undefined' ? window.location.origin : '',
): Promise<PublicClientApplication> {
  if (pca) {
    return pca;
  }
  if (pcaInit) {
    return pcaInit;
  }

  const publicConfig = resolveMsalPublicConfig();
  if (!publicConfig) {
    throw new Error(
      'MSAL is not configured (set NEXT_PUBLIC_AZURE_AD_CLIENT_ID and NEXT_PUBLIC_AZURE_AD_TENANT_ID)',
    );
  }
  if (!redirectUri) {
    throw new Error('MSAL redirectUri is required');
  }

  pcaInit = (async () => {
    const app = new PublicClientApplication(buildMsalConfiguration(publicConfig, redirectUri));
    await app.initialize();
    pca = app;
    return app;
  })();

  try {
    return await pcaInit;
  } catch (error) {
    pcaInit = null;
    throw error;
  }
}

/** Test helper — clears the singleton between Jest cases. */
export function resetMsalPublicClientForTests(): void {
  pca = null;
  pcaInit = null;
}
