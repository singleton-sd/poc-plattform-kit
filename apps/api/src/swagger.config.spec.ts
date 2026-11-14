import {
  buildOpenApiDocumentConfig,
  buildSwaggerUiOptions,
  resolveSwaggerApiScope,
  resolveSwaggerOAuth2RedirectUrl,
  resolveSwaggerOAuthUrls,
} from './swagger.config';

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

    it('falls back to the org issuer for offline export without KEYCLOAK_*', () => {
      const doc = buildOpenApiDocumentConfig({});
      expect(doc.components?.securitySchemes?.oauth2).toMatchObject({
        type: 'oauth2',
        flows: {
          authorizationCode: {
            authorizationUrl:
              'https://auth.singletonsd.com/realms/singletonsd/protocol/openid-connect/auth',
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
