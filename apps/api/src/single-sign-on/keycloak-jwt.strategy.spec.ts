import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { buildKeycloakJwtStrategyOptions, KeycloakJwtStrategy } from './keycloak-jwt.strategy';

describe('buildKeycloakJwtStrategyOptions', () => {
  it('returns null when Keycloak env is missing', () => {
    expect(buildKeycloakJwtStrategyOptions({})).toBeNull();
  });

  it('builds issuer, audience, and JWKS uri from env', () => {
    const options = buildKeycloakJwtStrategyOptions({
      KEYCLOAK_ISSUER: 'https://auth.example.test/realms/singletonsd/',
      KEYCLOAK_API_AUDIENCE: 'platform-kit-api',
    });
    expect(options).toMatchObject({
      audience: 'platform-kit-api',
      issuer: 'https://auth.example.test/realms/singletonsd',
    });
    expect(options?.secretOrKeyProvider).toBeDefined();
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
    process.env.KEYCLOAK_ISSUER = 'https://auth.example.test/realms/singletonsd';
    process.env.KEYCLOAK_API_AUDIENCE = 'platform-kit-api';
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
    process.env.KEYCLOAK_ISSUER = 'https://auth.example.test/realms/singletonsd';
    process.env.KEYCLOAK_API_AUDIENCE = 'platform-kit-api';
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
