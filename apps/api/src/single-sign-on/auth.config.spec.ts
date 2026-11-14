jest.mock('@auth/express/providers/keycloak', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    id: 'keycloak',
    name: 'Keycloak',
  })),
}));

import Keycloak from '@auth/express/providers/keycloak';
import {
  buildAuthConfig,
  extractKeycloakSessionFields,
  isAllowedAuthRedirect,
} from './auth.config';

describe('extractKeycloakSessionFields', () => {
  it('reads sub, roles, email_verified, and tenant_id from a Keycloak profile', () => {
    expect(
      extractKeycloakSessionFields({
        sub: 'kc-sub-1',
        email: 'a@b.com',
        email_verified: true,
        roles: ['tenant-admin'],
        tenant_id: 'tenant-xyz',
        realm_access: { roles: ['offline_access'] },
      }),
    ).toEqual({
      sub: 'kc-sub-1',
      email: 'a@b.com',
      email_verified: true,
      name: undefined,
      roles: ['tenant-admin'],
      role: undefined,
      tenant_id: 'tenant-xyz',
      realm_access: { roles: ['offline_access'] },
    });
  });

  it('returns empty object for missing profile', () => {
    expect(extractKeycloakSessionFields(undefined)).toEqual({});
  });
});

describe('buildAuthConfig', () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
  });

  it('returns null when Keycloak env is incomplete', () => {
    delete process.env.AUTH_SECRET;
    expect(buildAuthConfig()).toBeNull();
  });

  it('wires the Auth.js Keycloak provider and session callbacks', async () => {
    process.env.AUTH_SECRET = 'test-secret';
    process.env.KEYCLOAK_CLIENT_ID = 'client';
    process.env.KEYCLOAK_CLIENT_SECRET = 'secret';
    process.env.KEYCLOAK_ISSUER = 'https://auth.example.test/realms/singletonsd';
    delete process.env.AUTH_COOKIE_DOMAIN;

    const config = buildAuthConfig();
    expect(Keycloak).toHaveBeenCalledWith({
      clientId: 'client',
      clientSecret: 'secret',
      issuer: 'https://auth.example.test/realms/singletonsd',
    });
    expect(config?.providers).toEqual([expect.objectContaining({ id: 'keycloak' })]);
    expect(config?.callbacks?.jwt).toBeDefined();
    expect(config?.callbacks?.session).toBeDefined();
    expect(config?.cookies).toBeUndefined();

    const token = await config!.callbacks!.jwt!({
      token: { sub: 'sub-fallback' },
      profile: {
        sub: 'kc-sub-1',
        email: 'a@b.com',
        email_verified: true,
        roles: ['support-agent'],
        tenant_id: 'tenant-1',
      },
      account: null,
    } as never);

    expect(token).toMatchObject({
      sub: 'kc-sub-1',
      email: 'a@b.com',
      email_verified: true,
      roles: ['support-agent'],
      tenant_id: 'tenant-1',
    });

    const session = await config!.callbacks!.session!({
      session: { user: { email: 'a@b.com', name: 'A' }, expires: '' },
      token,
    } as never);

    expect(session.user).toMatchObject({
      id: 'kc-sub-1',
      sub: 'kc-sub-1',
      email_verified: true,
      roles: ['support-agent'],
      tenant_id: 'tenant-1',
    });
  });

  it('scopes Auth.js cookies when AUTH_COOKIE_DOMAIN is set', () => {
    process.env.AUTH_SECRET = 'test-secret';
    process.env.KEYCLOAK_CLIENT_ID = 'client';
    process.env.KEYCLOAK_CLIENT_SECRET = 'secret';
    process.env.KEYCLOAK_ISSUER = 'https://auth.example.test/realms/singletonsd';
    process.env.AUTH_COOKIE_DOMAIN = '.plattform-kit.poc.singletonsd.com';

    const config = buildAuthConfig();
    expect(config?.cookies?.sessionToken?.options).toMatchObject({
      domain: '.plattform-kit.poc.singletonsd.com',
      sameSite: 'lax',
      secure: true,
      httpOnly: true,
    });
    expect(config?.cookies?.csrfToken).toBeUndefined();
  });

  it('allows redirect callbacks to CORS SPA origins', async () => {
    process.env.AUTH_SECRET = 'test-secret';
    process.env.KEYCLOAK_CLIENT_ID = 'client';
    process.env.KEYCLOAK_CLIENT_SECRET = 'secret';
    process.env.KEYCLOAK_ISSUER = 'https://auth.example.test/realms/singletonsd';
    process.env.CORS_ORIGINS = 'https://app.plattform-kit.poc.singletonsd.com';

    const config = buildAuthConfig();
    const redirect = config!.callbacks!.redirect!;

    await expect(
      redirect({
        url: 'https://app.plattform-kit.poc.singletonsd.com/',
        baseUrl: 'https://api.plattform-kit.poc.singletonsd.com',
      } as never),
    ).resolves.toBe('https://app.plattform-kit.poc.singletonsd.com/');

    await expect(
      redirect({
        url: 'https://evil.example/',
        baseUrl: 'https://api.plattform-kit.poc.singletonsd.com',
      } as never),
    ).resolves.toBe('https://api.plattform-kit.poc.singletonsd.com');
  });
});

describe('isAllowedAuthRedirect', () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
  });

  it('allows relative paths and CORS origins', () => {
    process.env.CORS_ORIGINS = 'https://app.example.test';
    expect(isAllowedAuthRedirect('/support', 'https://api.example.test')).toBe(true);
    expect(isAllowedAuthRedirect('https://app.example.test/', 'https://api.example.test')).toBe(
      true,
    );
    expect(isAllowedAuthRedirect('https://other.example/', 'https://api.example.test')).toBe(false);
  });

  it('allows this-repo SWA preview hosts via instance prefix', () => {
    process.env.CORS_ORIGINS =
      'https://app.example.test,https://kind-rock-0f409fe00*.azurestaticapps.net';
    expect(
      isAllowedAuthRedirect(
        'https://kind-rock-0f409fe00-57.eastasia.7.azurestaticapps.net/',
        'https://api.example.test',
      ),
    ).toBe(true);
  });

  it('rejects open azurestaticapps wildcards for Auth.js redirects', () => {
    process.env.CORS_ORIGINS = 'https://*.azurestaticapps.net';
    expect(
      isAllowedAuthRedirect('https://attacker.7.azurestaticapps.net/', 'https://api.example.test'),
    ).toBe(false);
  });
});
