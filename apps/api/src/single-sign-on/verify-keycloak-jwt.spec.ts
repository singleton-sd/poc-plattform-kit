import { generateKeyPair, SignJWT, type KeyLike } from 'jose';
import {
  buildKeycloakJwtVerifyOptions,
  verifyKeycloakAccessTokenWithKey,
} from './verify-keycloak-jwt';

const ISSUER = 'http://127.0.0.1:8080/realms/plattform-kit-test';
const AUDIENCE = 'platform-kit-api';

describe('buildKeycloakJwtVerifyOptions', () => {
  it('returns null when Keycloak env is missing', () => {
    expect(buildKeycloakJwtVerifyOptions({})).toBeNull();
  });

  it('builds issuer, audience, and JWKS from env', () => {
    const options = buildKeycloakJwtVerifyOptions({
      KEYCLOAK_ISSUER: `${ISSUER}/`,
      KEYCLOAK_API_AUDIENCE: AUDIENCE,
      KEYCLOAK_CLIENT_ID: 'ignored-when-audience-set',
    });
    expect(options).toMatchObject({
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    expect(options?.jwks).toBeDefined();
  });

  it('falls back to client id when api audience is unset', () => {
    const options = buildKeycloakJwtVerifyOptions({
      KEYCLOAK_ISSUER: ISSUER,
      KEYCLOAK_CLIENT_ID: 'platform-kit-api',
    });
    expect(options?.audience).toBe('platform-kit-api');
  });
});

describe('verifyKeycloakAccessToken', () => {
  async function signedToken(claims: Record<string, unknown>, privateKey: KeyLike) {
    return new SignJWT(claims)
      .setProtectedHeader({ alg: 'RS256', kid: 'test' })
      .setIssuedAt()
      .sign(privateKey);
  }

  it('accepts a token with the expected issuer and audience', async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const token = await new SignJWT({
      sub: 'kc-sub-1',
      email: 'agent@example.com',
      email_verified: true,
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test' })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setExpirationTime('5m')
      .setIssuedAt()
      .sign(privateKey);

    await expect(
      verifyKeycloakAccessTokenWithKey(token, publicKey, { issuer: ISSUER, audience: AUDIENCE }),
    ).resolves.toMatchObject({ sub: 'kc-sub-1', aud: AUDIENCE, iss: ISSUER });
  });

  it('rejects a token with the wrong issuer', async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const token = await new SignJWT({ sub: 'kc-sub-1' })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer('http://evil.example/realms/other')
      .setAudience(AUDIENCE)
      .setExpirationTime('5m')
      .sign(privateKey);

    await expect(
      verifyKeycloakAccessTokenWithKey(token, publicKey, { issuer: ISSUER, audience: AUDIENCE }),
    ).rejects.toThrow(/unexpected "iss"/i);
  });

  it('rejects a token with the wrong audience', async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const token = await new SignJWT({ sub: 'kc-sub-1' })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(ISSUER)
      .setAudience('some-other-client')
      .setExpirationTime('5m')
      .sign(privateKey);

    await expect(
      verifyKeycloakAccessTokenWithKey(token, publicKey, { issuer: ISSUER, audience: AUDIENCE }),
    ).rejects.toThrow(/unexpected "aud"/i);
  });

  it('rejects an expired token', async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const token = await new SignJWT({ sub: 'kc-sub-1' })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(privateKey);

    await expect(
      verifyKeycloakAccessTokenWithKey(token, publicKey, { issuer: ISSUER, audience: AUDIENCE }),
    ).rejects.toThrow(/exp/i);
  });

  it('does not treat a self-signed payload as valid without signature checks', async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const other = await generateKeyPair('RS256');
    const token = await signedToken(
      { sub: 'kc-sub-1', iss: ISSUER, aud: AUDIENCE, exp: Math.floor(Date.now() / 1000) + 60 },
      other.privateKey,
    );

    await expect(
      verifyKeycloakAccessTokenWithKey(token, publicKey, { issuer: ISSUER, audience: AUDIENCE }),
    ).rejects.toThrow();
    expect(privateKey).toBeDefined();
  });
});
