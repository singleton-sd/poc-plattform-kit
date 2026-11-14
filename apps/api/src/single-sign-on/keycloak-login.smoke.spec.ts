jest.mock('@auth/express/providers/keycloak', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    id: 'keycloak',
    name: 'Keycloak',
  })),
}));

import { generateKeyPair, SignJWT } from 'jose';
import { buildAuthConfig } from './auth.config';
import { mapAuthJsUserToAuthenticatedUser } from './map-authjs-user';
import { verifyKeycloakAccessTokenWithKey } from './verify-keycloak-jwt';

/**
 * Login smoke: Auth.js Keycloak provider is wired, a mock RS256 token with
 * the test-realm issuer/audience is accepted, and the session profile maps
 * to a platform user. Does not call production Keycloak.
 */
describe('Keycloak login smoke', () => {
  const env = { ...process.env };
  const issuer = 'http://127.0.0.1:8080/realms/plattform-kit-test';
  const audience = 'platform-kit-api';

  afterEach(() => {
    process.env = { ...env };
  });

  it('exposes the Auth.js keycloak provider when env is set', () => {
    process.env.AUTH_SECRET = 'test-secret';
    process.env.KEYCLOAK_ISSUER = issuer;
    process.env.KEYCLOAK_CLIENT_ID = audience;
    process.env.KEYCLOAK_CLIENT_SECRET = 'test-client-secret';

    const config = buildAuthConfig();
    expect(config?.providers).toEqual([expect.objectContaining({ id: 'keycloak' })]);
  });

  it('maps a verified mock-OIDC profile after JWT validation', async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const token = await new SignJWT({
      email: 'testuser@example.test',
      email_verified: true,
      name: 'Test User',
      realm_access: { roles: ['tenant-admin'] },
    })
      .setProtectedHeader({ alg: 'RS256' })
      .setSubject('kc-test-sub')
      .setIssuer(issuer)
      .setAudience(audience)
      .setExpirationTime('5m')
      .sign(privateKey);

    const payload = await verifyKeycloakAccessTokenWithKey(token, publicKey, {
      issuer,
      audience,
    });
    const user = mapAuthJsUserToAuthenticatedUser(payload);

    expect(user).toMatchObject({
      keycloakSub: 'kc-test-sub',
      email: 'testuser@example.test',
      emailVerified: true,
      roles: ['tenant-admin'],
    });
  });
});
