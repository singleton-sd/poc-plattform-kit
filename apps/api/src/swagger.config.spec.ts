import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildOpenApiDocumentConfig,
  buildSwaggerUiOptions,
  resolveSwaggerApiScope,
  resolveSwaggerOAuth2RedirectUrl,
  resolveSwaggerOAuthUrls,
} from './swagger.config';

const apiPackageVersion = (
  JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8')) as { version: string }
).version;

describe('swagger.config', () => {
  describe('resolveSwaggerApiScope', () => {
    it('prefers explicit KEYCLOAK_SWAGGER_SCOPE', () => {
      expect(
        resolveSwaggerApiScope({
          KEYCLOAK_SWAGGER_SCOPE: 'platform-kit-api',
          KEYCLOAK_API_AUDIENCE: 'ignored',
          KEYCLOAK_CLIENT_ID: 'ignored',
        }),
      ).toBe('platform-kit-api');
    });

    it('does not treat audience or client id as a scope', () => {
      expect(resolveSwaggerApiScope({ KEYCLOAK_API_AUDIENCE: 'platform-kit-api' })).toBeNull();
      expect(resolveSwaggerApiScope({ KEYCLOAK_CLIENT_ID: 'client-1' })).toBeNull();
    });

    it('returns null when Keycloak ids are missing', () => {
      expect(resolveSwaggerApiScope({})).toBeNull();
    });
  });

  describe('resolveSwaggerOAuthUrls', () => {
    it('builds Keycloak OIDC endpoints', () => {
      expect(
        resolveSwaggerOAuthUrls({
          KEYCLOAK_ISSUER: 'https://auth.example.test/realms/singletonsd/',
        }),
      ).toEqual({
        authorizationUrl:
          'https://auth.example.test/realms/singletonsd/protocol/openid-connect/auth',
        tokenUrl: 'https://auth.example.test/realms/singletonsd/protocol/openid-connect/token',
      });
    });

    it('returns null without issuer', () => {
      expect(resolveSwaggerOAuthUrls({})).toBeNull();
    });
  });

  describe('resolveSwaggerOAuth2RedirectUrl', () => {
    it('returns undefined so Swagger UI uses the current host (preview-safe)', () => {
      expect(
        resolveSwaggerOAuth2RedirectUrl({
          AUTH_URL: 'https://api.plattform-kit.poc.singletonsd.com/',
        }),
      ).toBeUndefined();
    });

    it('prefers SWAGGER_OAUTH2_REDIRECT_URL when set', () => {
      expect(
        resolveSwaggerOAuth2RedirectUrl({
          SWAGGER_OAUTH2_REDIRECT_URL: 'http://localhost:3001/docs/oauth2-redirect.html',
          AUTH_URL: 'https://api.example.com',
        }),
      ).toBe('http://localhost:3001/docs/oauth2-redirect.html');
    });
  });

  describe('buildOpenApiDocumentConfig', () => {
    it('uses same-origin relative token proxy URL (not AUTH_URL / prod)', () => {
      const doc = buildOpenApiDocumentConfig({
        KEYCLOAK_ISSUER: 'https://auth.example.test/realms/singletonsd',
        KEYCLOAK_CLIENT_ID: 'client-1',
        KEYCLOAK_API_AUDIENCE: 'platform-kit-api',
        AUTH_URL: 'https://api.example.com',
      });
      const schemes = doc.components?.securitySchemes ?? {};
      expect(schemes.bearer).toBeDefined();
      expect(schemes['x-tenant-id']).toBeDefined();
      expect(schemes.oauth2).toMatchObject({
        type: 'oauth2',
        flows: {
          authorizationCode: {
            authorizationUrl:
              'https://auth.example.test/realms/singletonsd/protocol/openid-connect/auth',
            tokenUrl: '/docs/oauth2/token',
          },
        },
      });
    });

    it('prefers APP_VERSION over package.json for the document version', () => {
      const doc = buildOpenApiDocumentConfig({ APP_VERSION: '9.9.9' });
      expect(doc.info.version).toBe('9.9.9');
    });

    it('trims a padded APP_VERSION', () => {
      expect(buildOpenApiDocumentConfig({ APP_VERSION: '  9.9.9  ' }).info.version).toBe('9.9.9');
    });

    it('falls back to package.json when APP_VERSION is absent, empty, or whitespace', () => {
      expect(buildOpenApiDocumentConfig({}).info.version).toBe(apiPackageVersion);
      expect(buildOpenApiDocumentConfig({ APP_VERSION: '' }).info.version).toBe(apiPackageVersion);
      expect(buildOpenApiDocumentConfig({ APP_VERSION: '   ' }).info.version).toBe(
        apiPackageVersion,
      );
    });

    it('uses a per-product realm placeholder when KEYCLOAK_ISSUER is unset', () => {
      const doc = buildOpenApiDocumentConfig({});
      expect(doc.components?.securitySchemes?.oauth2).toMatchObject({
        type: 'oauth2',
        flows: {
          authorizationCode: {
            authorizationUrl:
              'https://auth.singletonsd.com/realms/<product>/protocol/openid-connect/auth',
            tokenUrl: '/docs/oauth2/token',
          },
        },
      });
      expect(doc.components?.securitySchemes?.bearer).toBeDefined();
    });
  });

  describe('buildSwaggerUiOptions', () => {
    it('enables PKCE and prefills clientId without hardcoding prod redirect', () => {
      const options = buildSwaggerUiOptions({
        KEYCLOAK_CLIENT_ID: 'client-1',
        KEYCLOAK_API_AUDIENCE: 'platform-kit-api',
        AUTH_URL: 'https://api.plattform-kit.poc.singletonsd.com',
      });
      expect(options.swaggerOptions).toMatchObject({
        persistAuthorization: true,
        initOAuth: {
          clientId: 'client-1',
          usePkceWithAuthorizationCodeGrant: true,
          scopes: ['openid', 'profile', 'email'],
        },
      });
      expect(options.swaggerOptions?.oauth2RedirectUrl).toBeUndefined();
      expect(options.customJsStr).toEqual(expect.stringContaining('BroadcastChannel'));
    });
  });
});
