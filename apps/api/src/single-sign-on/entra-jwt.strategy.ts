import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import {
  mapEntraClaims,
  type AuthenticatedUser,
  type EntraClaims,
} from '@poc-plattform-kit/pillar-single-sign-on';
import { passportJwtSecret } from 'jwks-rsa';
import { ExtractJwt, Strategy } from 'passport-jwt';

export function buildEntraJwtStrategyOptions(env: NodeJS.ProcessEnv = process.env) {
  const tenantId = env.AZURE_AD_TENANT_ID?.trim();
  const apiAudience = env.AZURE_AD_API_AUDIENCE?.trim();
  const clientId = env.AZURE_AD_CLIENT_ID?.trim();

  // Accept App ID URI and/or GUID client id — Swagger same-app tokens (AADSTS90009
  // workaround) use api://{clientId} as aud while App Config may still store the
  // hostname URI as AZURE_AD_API_AUDIENCE.
  const audiences = [
    ...new Set(
      [apiAudience, clientId, clientId ? `api://${clientId}` : undefined].filter(
        (value): value is string => Boolean(value),
      ),
    ),
  ];

  if (!tenantId || audiences.length === 0) {
    return null;
  }

  const issuer = `https://login.microsoftonline.com/${tenantId}/v2.0`;
  const jwksUri = `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`;

  return {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    audience: audiences.length === 1 ? audiences[0] : audiences,
    issuer,
    algorithms: ['RS256'] as const,
    secretOrKeyProvider: passportJwtSecret({
      cache: true,
      rateLimit: true,
      jwksRequestsPerMinute: 10,
      jwksUri,
    }),
  };
}

@Injectable()
export class EntraJwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    const options = buildEntraJwtStrategyOptions();
    if (!options) {
      super({
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: 'entra-jwt-not-configured',
        algorithms: ['HS256'],
      });
      return;
    }
    super(options);
  }

  validate(payload: EntraClaims): AuthenticatedUser {
    try {
      return mapEntraClaims(payload);
    } catch {
      throw new UnauthorizedException('Invalid Entra token claims');
    }
  }
}
