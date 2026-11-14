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
  let strategy: KeycloakJwtStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [KeycloakJwtStrategy],
    }).compile();
    strategy = module.get(KeycloakJwtStrategy);
  });

  it('maps valid Keycloak payload to AuthenticatedUser', () => {
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

  it('rejects invalid claims', () => {
    expect(() => strategy.validate({ email: 'a@b.com' })).toThrow(UnauthorizedException);
  });
});
