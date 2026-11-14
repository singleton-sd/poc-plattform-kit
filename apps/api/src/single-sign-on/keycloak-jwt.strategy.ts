import { randomBytes } from 'node:crypto';
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
  private readonly configured: boolean;

  constructor() {
    const options = buildKeycloakJwtStrategyOptions();
    super(
      options ?? {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        // Unpredictable key so a public placeholder cannot mint accepted tokens.
        secretOrKey: randomBytes(32).toString('hex'),
        algorithms: ['HS256'],
      },
    );
    this.configured = Boolean(options);
  }

  validate(payload: KeycloakClaims): AuthenticatedUser {
    if (!this.configured) {
      throw new UnauthorizedException('Keycloak JWT is not configured');
    }
    try {
      return mapKeycloakClaims(payload);
    } catch {
      throw new UnauthorizedException('Invalid Keycloak token claims');
    }
  }
}
