import type { ExpressAuthConfig } from '@auth/express';
import MicrosoftEntraID from '@auth/express/providers/microsoft-entra-id';

export function buildAuthConfig(): ExpressAuthConfig | null {
  const secret = process.env.AUTH_SECRET?.trim();
  const clientId = process.env.AZURE_AD_CLIENT_ID?.trim();
  const clientSecret = process.env.AZURE_AD_CLIENT_SECRET?.trim();
  const tenantId = process.env.AZURE_AD_TENANT_ID?.trim();

  if (!secret || !clientId || !clientSecret || !tenantId) {
    return null;
  }

  return {
    secret,
    trustHost: true,
    providers: [
      MicrosoftEntraID({
        clientId,
        clientSecret,
        issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
      }),
    ],
  };
}
