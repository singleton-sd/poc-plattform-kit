import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { buildEntraJwtStrategyOptions, EntraJwtStrategy } from './entra-jwt.strategy';

describe('buildEntraJwtStrategyOptions', () => {
  it('returns null when Entra env is missing', () => {
    expect(buildEntraJwtStrategyOptions({})).toBeNull();
  });

  it('builds issuer, audience, and JWKS uri from env', () => {
    const options = buildEntraJwtStrategyOptions({
      AZURE_AD_TENANT_ID: 'tenant-1',
      AZURE_AD_API_AUDIENCE: 'api://aud',
      AZURE_AD_CLIENT_ID: 'client-ignored',
    });
    expect(options).toMatchObject({
      audience: 'api://aud',
      issuer: 'https://login.microsoftonline.com/tenant-1/v2.0',
    });
    expect(options?.secretOrKeyProvider).toBeDefined();
  });
});

describe('EntraJwtStrategy', () => {
  let strategy: EntraJwtStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EntraJwtStrategy],
    }).compile();
    strategy = module.get(EntraJwtStrategy);
  });

  it('maps valid Entra payload to AuthenticatedUser', () => {
    expect(
      strategy.validate({
        oid: 'oid-1',
        email: 'agent@example.com',
        name: 'Agent',
        roles: ['support-agent'],
      }),
    ).toEqual({
      entraOid: 'oid-1',
      email: 'agent@example.com',
      name: 'Agent',
      role: 'support-agent',
      id: 'oid-1',
    });
  });

  it('rejects invalid claims', () => {
    expect(() => strategy.validate({ email: 'a@b.com' })).toThrow(UnauthorizedException);
  });
});
