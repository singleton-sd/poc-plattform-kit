import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DocumentBuilder, type SwaggerCustomOptions } from '@nestjs/swagger';

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
 * Entra API scope for Swagger OAuth2 (authorization code + PKCE).
 * Matches MSAL preview convention: `{audience}/.default` (audience is App ID URI).
 */
export function resolveSwaggerApiScope(env: EnvBag = process.env): string | null {
  const explicit = envTrim(env, 'AZURE_AD_SWAGGER_SCOPE') || envTrim(env, 'AZURE_AD_API_SCOPE');
  if (explicit) {
    return explicit;
  }

  const audience = envTrim(env, 'AZURE_AD_API_AUDIENCE');
  if (audience) {
    if (audience.endsWith('/.default')) {
      return audience;
    }
    return audience.includes('://') ? `${audience}/.default` : `api://${audience}/.default`;
  }

  const clientId = envTrim(env, 'AZURE_AD_CLIENT_ID');
  if (!clientId) {
    return null;
  }
  return `api://${clientId}/.default`;
}

/** Entra v2 authorize + token endpoints for the directory tenant. */
export function resolveSwaggerOAuthUrls(env: EnvBag = process.env): {
  authorizationUrl: string;
  tokenUrl: string;
} | null {
  const tenantId = envTrim(env, 'AZURE_AD_TENANT_ID');
  if (!tenantId) {
    return null;
  }
  const base = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0`;
  return {
    authorizationUrl: `${base}/authorize`,
    tokenUrl: `${base}/token`,
  };
}

/**
 * Absolute Swagger OAuth2 redirect URL registered in Entra as a SPA redirect URI.
 * Defaults to `{AUTH_URL}/docs/oauth2-redirect.html`.
 */
export function resolveSwaggerOAuth2RedirectUrl(env: EnvBag = process.env): string | undefined {
  const explicit = envTrim(env, 'SWAGGER_OAUTH2_REDIRECT_URL');
  if (explicit) {
    return explicit;
  }
  const authUrl = envTrim(env, 'AUTH_URL');
  if (!authUrl) {
    return undefined;
  }
  return `${authUrl.replace(/\/+$/, '')}/docs/oauth2-redirect.html`;
}

/** Shared DocumentBuilder config for runtime Swagger UI and offline OpenAPI export. */
export function buildOpenApiDocumentConfig(env: EnvBag = process.env) {
  const builder = new DocumentBuilder()
    .setTitle('Platform Kit API')
    .setDescription('poc-plattform-kit API')
    .setVersion(readPackageVersion())
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'x-tenant-id', in: 'header' }, 'x-tenant-id');

  // Always publish the oauth2 scheme so offline OpenAPI export stays stable
  // (CI has no AZURE_AD_*). Runtime initOAuth still prefills clientId when set.
  const tenantId = envTrim(env, 'AZURE_AD_TENANT_ID') ?? 'common';
  const oauthUrls = {
    authorizationUrl: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
    tokenUrl: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
  };
  const apiScope = resolveSwaggerApiScope(env) ?? 'api://platform-kit/.default';

  builder.addOAuth2(
    {
      type: 'oauth2',
      description:
        'Microsoft Entra ID (authorization code + PKCE). Register SPA redirect URI `/docs/oauth2-redirect.html` on the API app registration.',
      flows: {
        authorizationCode: {
          authorizationUrl: oauthUrls.authorizationUrl,
          tokenUrl: oauthUrls.tokenUrl,
          scopes: {
            openid: 'Sign in',
            profile: 'User profile',
            offline_access: 'Refresh token',
            [apiScope]: 'Access Platform Kit API',
          },
        },
      },
    },
    'oauth2',
  );

  return builder.build();
}

/** Swagger UI options — prefill Entra client id and enable PKCE. */
export function buildSwaggerUiOptions(env: EnvBag = process.env): SwaggerCustomOptions {
  const clientId = envTrim(env, 'AZURE_AD_CLIENT_ID');
  const apiScope = resolveSwaggerApiScope(env);
  const oauth2RedirectUrl = resolveSwaggerOAuth2RedirectUrl(env);

  const scopes = apiScope
    ? ['openid', 'profile', 'offline_access', apiScope]
    : ['openid', 'profile'];

  return {
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
