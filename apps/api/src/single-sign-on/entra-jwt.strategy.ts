import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import {
  mapEntraClaims,
  type AuthenticatedUser,
  type EntraClaims,
} from '@poc-plattform-kit/pillar-single-sign-on';
import { passportJwtSecret } from 'jwks-rsa';
import { ExtractJwt, Strategy } from 'passport-jwt';

/**
 * Entra v2 access tokens for an API with `requestedAccessTokenVersion: 2` use the
 * app's client id as `aud`. Older / App ID URI–style tokens use
 * `AZURE_AD_API_AUDIENCE` (e.g. `api://…`). Also accept `api://{clientId}` for
 * same-app Swagger Authorize tokens. Accept all so SPA Bearer and URI-audience
 * clients keep working.
 */
export function resolveEntraJwtAudiences(env: NodeJS.ProcessEnv = process.env): string[] {
  const configured = env.AZURE_AD_API_AUDIENCE?.trim();
  const clientId = env.AZURE_AD_CLIENT_ID?.trim();
  return [
    ...new Set(
      [configured, clientId, clientId ? `api://${clientId}` : undefined].filter(
        (value): value is string => Boolean(value),
      ),
    ),
  ];
}

export function buildEntraJwtStrategyOptions(env: NodeJS.ProcessEnv = process.env) {
  const tenantId = env.AZURE_AD_TENANT_ID?.trim();
  const audiences = resolveEntraJwtAudiences(env);

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
