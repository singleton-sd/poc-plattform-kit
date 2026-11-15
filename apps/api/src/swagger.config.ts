import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DocumentBuilder, type SwaggerCustomOptions } from '@nestjs/swagger';
import {
  keycloakAuthorizationUrl,
  resolveKeycloakClientId,
  resolveKeycloakIssuer,
} from './single-sign-on/keycloak-issuer';
import { buildSwaggerOauth2BridgeScript } from './swagger-oauth2-redirect';
import { resolveSwaggerTokenProxyUrl } from './swagger-oauth2-token-proxy';

type EnvBag = NodeJS.ProcessEnv | Record<string, string | undefined>;

function readPackageVersion(): string {
  try {
    const pkgPath = join(__dirname, '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function envTrim(env: EnvBag, key: string): string | undefined {
  const value = env[key]?.trim();
  return value || undefined;
}

/**
 * Optional extra Swagger OAuth2 scope (Keycloak client scope name).
 * Audience belongs on token mappers, not in the authorize `scope` query.
 */
export function resolveSwaggerApiScope(env: EnvBag = process.env): string | null {
  return envTrim(env, 'KEYCLOAK_SWAGGER_SCOPE') || envTrim(env, 'KEYCLOAK_API_SCOPE') || null;
}

/** Keycloak authorize + token endpoints for the configured issuer. */
export function resolveSwaggerOAuthUrls(env: EnvBag = process.env): {
  authorizationUrl: string;
  tokenUrl: string;
} | null {
  const issuer = resolveKeycloakIssuer(env);
  if (!issuer) {
    return null;
  }
  return {
    authorizationUrl: keycloakAuthorizationUrl(issuer),
    tokenUrl: `${issuer}/protocol/openid-connect/token`,
  };
}

/**
 * Optional absolute override for Swagger OAuth2 redirect.
 * Prefer unset: customJs patches `{currentOrigin}/docs/oauth2-redirect.html`
 * (Swagger’s built-in default for `/docs` wrongly uses `/oauth2-redirect.html`,
 * and baking AUTH_URL would send ACA previews to prod).
 */
export function resolveSwaggerOAuth2RedirectUrl(env: EnvBag = process.env): string | undefined {
  return envTrim(env, 'SWAGGER_OAUTH2_REDIRECT_URL');
}

/** Offline OpenAPI placeholder — one Keycloak realm per product (ADR-004), never `singletonsd`. */
const productRealmAuthorizePlaceholder =
  'https://auth.singletonsd.com/realms/<product>/protocol/openid-connect/auth';

/** Shared DocumentBuilder config for runtime Swagger UI and offline OpenAPI export. */
export function buildOpenApiDocumentConfig(env: EnvBag = process.env) {
  const builder = new DocumentBuilder()
    .setTitle('Platform Kit API')
    .setDescription('poc-plattform-kit API')
    .setVersion(readPackageVersion())
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'x-tenant-id', in: 'header' }, 'x-tenant-id');

  // Always publish the oauth2 scheme so offline OpenAPI export stays stable
  // (CI has no KEYCLOAK_*). Runtime initOAuth still prefills clientId when set.
  // tokenUrl is our Nest proxy (not Keycloak) so Swagger can exchange codes
  // without browser CORS / exposing client_secret.
  const issuer = resolveKeycloakIssuer(env);
  const authorizationUrl = issuer
    ? keycloakAuthorizationUrl(issuer)
    : productRealmAuthorizePlaceholder;
  const tokenUrl = resolveSwaggerTokenProxyUrl(env) ?? '/docs/oauth2/token';
  const oauthUrls = {
    authorizationUrl,
    tokenUrl,
  };
  const apiScope = resolveSwaggerApiScope(env);

  builder.addOAuth2(
    {
      type: 'oauth2',
      description:
        'Keycloak (authorization code + PKCE). Register Web redirect URI `/docs/oauth2-redirect.html` on the API OIDC client. Token exchange is proxied by this API.',
      flows: {
        authorizationCode: {
          authorizationUrl: oauthUrls.authorizationUrl,
          tokenUrl: oauthUrls.tokenUrl,
          scopes: {
            openid: 'Sign in',
            profile: 'User profile',
            email: 'Email',
            ...(apiScope ? { [apiScope]: 'Access Platform Kit API' } : {}),
          },
        },
      },
    },
    'oauth2',
  );

  return builder.build();
}

/** Swagger UI options — prefill Keycloak client id and enable PKCE. */
export function buildSwaggerUiOptions(env: EnvBag = process.env): SwaggerCustomOptions {
  const clientId = resolveKeycloakClientId(env);
  const apiScope = resolveSwaggerApiScope(env);
  const oauth2RedirectUrl = resolveSwaggerOAuth2RedirectUrl(env);

  const scopes = apiScope
    ? ['openid', 'profile', 'email', apiScope]
    : ['openid', 'profile', 'email'];

  return {
    customJsStr: buildSwaggerOauth2BridgeScript(),
    swaggerOptions: {
      persistAuthorization: true,
      ...(oauth2RedirectUrl ? { oauth2RedirectUrl } : {}),
      initOAuth: {
        ...(clientId ? { clientId } : {}),
        appName: 'Platform Kit API',
        scopes,
        usePkceWithAuthorizationCodeGrant: true,
        scopeSeparator: ' ',
      },
    },
  };
}
