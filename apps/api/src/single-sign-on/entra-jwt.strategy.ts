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
  const audience = env.AZURE_AD_API_AUDIENCE?.trim() || env.AZURE_AD_CLIENT_ID?.trim();

  if (!tenantId || !audience) {
    return null;
  }

  const issuer = `https://login.microsoftonline.com/${tenantId}/v2.0`;
  const jwksUri = `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`;

  return {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    audience,
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
