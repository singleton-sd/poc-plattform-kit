import { buildMsalConfiguration, resolveMsalPublicConfig } from './msal-config';

describe('msal-config', () => {
  it('returns null when public Entra env is incomplete', () => {
    expect(
      resolveMsalPublicConfig({
        NEXT_PUBLIC_AZURE_AD_CLIENT_ID: 'client',
      }),
    ).toBeNull();
  });

  it('defaults api scope to api://{clientId}/.default', () => {
    expect(
      resolveMsalPublicConfig({
        NEXT_PUBLIC_AZURE_AD_CLIENT_ID: 'client-1',
        NEXT_PUBLIC_AZURE_AD_TENANT_ID: 'tenant-1',
      }),
    ).toEqual({
      clientId: 'client-1',
      tenantId: 'tenant-1',
      apiScope: 'api://client-1/.default',
    });
  });

  it('honours an explicit API scope', () => {
    expect(
      resolveMsalPublicConfig({
        NEXT_PUBLIC_AZURE_AD_CLIENT_ID: 'client-1',
        NEXT_PUBLIC_AZURE_AD_TENANT_ID: 'tenant-1',
        NEXT_PUBLIC_AZURE_AD_API_SCOPE: 'api://resource/.default',
      })?.apiScope,
    ).toBe('api://resource/.default');
  });

  it('builds MSAL configuration for the SPA origin', () => {
    const config = buildMsalConfiguration(
      {
        clientId: 'client-1',
        tenantId: 'tenant-1',
        apiScope: 'client-1/.default',
      },
      'https://kind-rock-0f409fe00-76.eastasia.7.azurestaticapps.net',
    );

    expect(config.auth).toMatchObject({
      clientId: 'client-1',
      authority: 'https://login.microsoftonline.com/tenant-1',
      redirectUri: 'https://kind-rock-0f409fe00-76.eastasia.7.azurestaticapps.net',
    });
  });
});
