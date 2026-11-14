import { buildOidcSettings, resolveOidcPublicConfig } from './oidc-config';

describe('oidc-config', () => {
  it('returns null when public Keycloak env is incomplete', () => {
    expect(
      resolveOidcPublicConfig({
        NEXT_PUBLIC_KEYCLOAK_CLIENT_ID: 'client',
      }),
    ).toBeNull();
  });

  it('defaults audience to the SPA client id', () => {
    expect(
      resolveOidcPublicConfig({
        NEXT_PUBLIC_KEYCLOAK_ISSUER: 'https://auth.example.test/realms/singletonsd/',
        NEXT_PUBLIC_KEYCLOAK_CLIENT_ID: 'platform-kit-web',
      }),
    ).toEqual({
      issuer: 'https://auth.example.test/realms/singletonsd',
      clientId: 'platform-kit-web',
      audience: 'platform-kit-web',
    });
  });

  it('honours an explicit API audience', () => {
    expect(
      resolveOidcPublicConfig({
        NEXT_PUBLIC_KEYCLOAK_ISSUER: 'https://auth.example.test/realms/singletonsd',
        NEXT_PUBLIC_KEYCLOAK_CLIENT_ID: 'platform-kit-web',
        NEXT_PUBLIC_KEYCLOAK_API_AUDIENCE: 'platform-kit-api',
      })?.audience,
    ).toBe('platform-kit-api');
  });

  it('builds OIDC settings for the SPA origin', () => {
    const settings = buildOidcSettings(
      {
        issuer: 'https://auth.example.test/realms/singletonsd',
        clientId: 'platform-kit-web',
        audience: 'platform-kit-api',
      },
      'https://kind-rock-0f409fe00-76.eastasia.7.azurestaticapps.net',
    );

    expect(settings).toMatchObject({
      authority: 'https://auth.example.test/realms/singletonsd',
      client_id: 'platform-kit-web',
      redirect_uri: 'https://kind-rock-0f409fe00-76.eastasia.7.azurestaticapps.net',
      response_type: 'code',
      scope: 'openid profile email platform-kit-api',
    });
  });
});
