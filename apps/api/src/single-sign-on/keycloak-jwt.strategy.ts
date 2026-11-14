import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import {
  mapKeycloakClaims,
  type AuthenticatedUser,
  type KeycloakClaims,
} from '@poc-plattform-kit/pillar-single-sign-on';
import { passportJwtSecret } from 'jwks-rsa';
import { ExtractJwt, Strategy } from 'passport-jwt';
import {
  keycloakJwksUri,
  resolveKeycloakApiAudience,
  resolveKeycloakIssuer,
} from './keycloak-issuer';

export function buildKeycloakJwtStrategyOptions(env: NodeJS.ProcessEnv = process.env) {
  const issuer = resolveKeycloakIssuer(env);
  const audience = resolveKeycloakApiAudience(env);
  if (!issuer || !audience) {
    return null;
  }

  return {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    audience,
    issuer,
    algorithms: ['RS256'] as const,
    secretOrKeyProvider: passportJwtSecret({
      cache: true,
      rateLimit: true,
      jwksRequestsPerMinute: 10,
      jwksUri: keycloakJwksUri(issuer),
    }),
  };
}

@Injectable()
export class KeycloakJwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    const options = buildKeycloakJwtStrategyOptions();
    if (!options) {
      super({
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: 'keycloak-jwt-not-configured',
        algorithms: ['HS256'],
      });
      return;
    }
    super(options);
  }

  validate(payload: KeycloakClaims): AuthenticatedUser {
    try {
      return mapKeycloakClaims(payload);
    } catch {
      throw new UnauthorizedException('Invalid Keycloak token claims');
    }
  }
}
