import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { generateKeyPair, exportSPKI, SignJWT, type KeyLike } from 'jose';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { buildKeycloakJwtStrategyOptions, KeycloakJwtStrategy } from './keycloak-jwt.strategy';

const ISSUER = 'http://127.0.0.1:8080/realms/plattform-kit-test';
const AUDIENCE = 'platform-kit-api';

describe('buildKeycloakJwtStrategyOptions', () => {
  it('returns null when Keycloak env is missing', () => {
    expect(buildKeycloakJwtStrategyOptions({})).toBeNull();
  });

  it('builds issuer, audience, and JWKS uri from env', () => {
    const options = buildKeycloakJwtStrategyOptions({
      KEYCLOAK_ISSUER: `${ISSUER}/`,
      KEYCLOAK_API_AUDIENCE: AUDIENCE,
    });
    expect(options).toMatchObject({
      audience: AUDIENCE,
      issuer: ISSUER,
      algorithms: ['RS256'],
    });
    expect(options?.secretOrKeyProvider).toBeDefined();
  });

  it('falls back to client id when api audience is unset', () => {
    const options = buildKeycloakJwtStrategyOptions({
      KEYCLOAK_ISSUER: ISSUER,
      KEYCLOAK_CLIENT_ID: AUDIENCE,
    });
    expect(options?.audience).toBe(AUDIENCE);
  });
});

describe('KeycloakJwtStrategy', () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
  });

  async function compileStrategy(): Promise<KeycloakJwtStrategy> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [KeycloakJwtStrategy],
    }).compile();
    return module.get(KeycloakJwtStrategy);
  }

  it('maps valid Keycloak payload to AuthenticatedUser when configured', async () => {
    process.env.KEYCLOAK_ISSUER = ISSUER;
    process.env.KEYCLOAK_API_AUDIENCE = AUDIENCE;
    const strategy = await compileStrategy();

    expect(
      strategy.validate({
        sub: 'kc-sub-1',
        email: 'agent@example.com',
        name: 'Agent',
        email_verified: true,
        realm_access: { roles: ['support-agent'] },
      }),
    ).toEqual({
      keycloakSub: 'kc-sub-1',
      entraOid: null,
      email: 'agent@example.com',
      name: 'Agent',
      roles: ['support-agent'],
      id: 'kc-sub-1',
      tenantId: null,
      emailVerified: true,
    });
  });

  it('rejects invalid claims', async () => {
    process.env.KEYCLOAK_ISSUER = ISSUER;
    process.env.KEYCLOAK_API_AUDIENCE = AUDIENCE;
    const strategy = await compileStrategy();
    expect(() => strategy.validate({ email: 'a@b.com' })).toThrow(UnauthorizedException);
  });

  it('rejects every payload when Keycloak issuer or audience is missing', async () => {
    delete process.env.KEYCLOAK_ISSUER;
    delete process.env.KEYCLOAK_API_AUDIENCE;
    delete process.env.KEYCLOAK_CLIENT_ID;
    const strategy = await compileStrategy();
    expect(() =>
      strategy.validate({
        sub: 'kc-sub-1',
        email: 'agent@example.com',
        name: 'Agent',
      }),
    ).toThrow(/not configured/);
  });
});

describe('passport-jwt Keycloak issuer/audience/expiry', () => {
  async function signedToken(
    claims: Record<string, unknown>,
    privateKey: KeyLike,
    extras: { issuer?: string; audience?: string; exp?: string | number } = {},
  ) {
    let jwt = new SignJWT(claims).setProtectedHeader({ alg: 'RS256', kid: 'test' }).setIssuedAt();
    jwt = jwt.setIssuer(extras.issuer ?? ISSUER);
    jwt = jwt.setAudience(extras.audience ?? AUDIENCE);
    jwt = jwt.setExpirationTime(extras.exp ?? '5m');
    return jwt.sign(privateKey);
  }

  function passportStrategy(publicKeyPem: string): Strategy {
    const options = buildKeycloakJwtStrategyOptions({
      KEYCLOAK_ISSUER: ISSUER,
      KEYCLOAK_API_AUDIENCE: AUDIENCE,
    });
    if (!options) {
      throw new Error('expected Keycloak JWT strategy options');
    }
    return new Strategy(
      {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        audience: options.audience,
        issuer: options.issuer,
        algorithms: [...options.algorithms],
        secretOrKey: publicKeyPem,
      },
      (payload, done) => done(null, payload),
    );
  }

  function authenticate(strategy: Strategy, token: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const req = { headers: { authorization: `Bearer ${token}` } };
      Object.assign(strategy, {
        success(user: unknown) {
          resolve(user);
        },
        fail(challenge?: unknown) {
          const message =
            challenge instanceof Error
              ? challenge.message
              : typeof challenge === 'string'
                ? challenge
                : JSON.stringify(challenge ?? 'fail');
          reject(new Error(message));
        },
        error(err: Error) {
          reject(err);
        },
      });
      strategy.authenticate(req as never);
    });
  }

  it('accepts a token with the expected issuer and audience', async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const publicKeyPem = await exportSPKI(publicKey);
    const token = await signedToken(
      { sub: 'kc-sub-1', email: 'agent@example.com', email_verified: true },
      privateKey,
    );

    await expect(authenticate(passportStrategy(publicKeyPem), token)).resolves.toMatchObject({
      sub: 'kc-sub-1',
      aud: AUDIENCE,
      iss: ISSUER,
    });
  });

  it('rejects a token with the wrong issuer', async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const token = await signedToken({ sub: 'kc-sub-1' }, privateKey, {
      issuer: 'http://evil.example/realms/other',
    });

    await expect(
      authenticate(passportStrategy(await exportSPKI(publicKey)), token),
    ).rejects.toThrow(/issuer/i);
  });

  it('rejects a token with the wrong audience', async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const token = await signedToken({ sub: 'kc-sub-1' }, privateKey, {
      audience: 'some-other-client',
    });

    await expect(
      authenticate(passportStrategy(await exportSPKI(publicKey)), token),
    ).rejects.toThrow(/audience/i);
  });

  it('rejects an expired token', async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const token = await signedToken({ sub: 'kc-sub-1' }, privateKey, {
      exp: Math.floor(Date.now() / 1000) - 60,
    });

    await expect(
      authenticate(passportStrategy(await exportSPKI(publicKey)), token),
    ).rejects.toThrow(/expired/i);
  });

  it('does not treat a self-signed payload as valid without signature checks', async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const other = await generateKeyPair('RS256');
    const token = await signedToken(
      { sub: 'kc-sub-1', email: 'agent@example.com' },
      other.privateKey,
    );

    await expect(
      authenticate(passportStrategy(await exportSPKI(publicKey)), token),
    ).rejects.toThrow();
    expect(privateKey).toBeDefined();
  });
});
