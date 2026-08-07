import {
  buildOpenApiDocumentConfig,
  buildSwaggerUiOptions,
  resolveSwaggerApiScope,
  resolveSwaggerOAuth2RedirectUrl,
  resolveSwaggerOAuthUrls,
} from './swagger.config';

describe('swagger.config', () => {
  describe('resolveSwaggerApiScope', () => {
    it('prefers explicit AZURE_AD_SWAGGER_SCOPE', () => {
      expect(
        resolveSwaggerApiScope({
          AZURE_AD_SWAGGER_SCOPE: 'api://custom/.default',
          AZURE_AD_API_AUDIENCE: 'api://ignored',
          AZURE_AD_CLIENT_ID: 'ignored',
        }),
      ).toBe('api://custom/.default');
    });

    it('prefers {clientId}/.default over hostname App ID URI (AADSTS90009/500011)', () => {
      expect(
        resolveSwaggerApiScope({
          AZURE_AD_CLIENT_ID: 'be2e487d-9cea-4060-a600-dbb68434e128',
          AZURE_AD_API_AUDIENCE: 'api://api.plattform-kit.poc.singletonsd.com',
        }),
      ).toBe('be2e487d-9cea-4060-a600-dbb68434e128/.default');
    });

    it('falls back to AZURE_AD_API_AUDIENCE when client id is absent', () => {
      expect(resolveSwaggerApiScope({ AZURE_AD_API_AUDIENCE: 'api://platform-kit' })).toBe(
        'api://platform-kit/.default',
      );
    });

    it('defaults to {clientId}/.default', () => {
      expect(resolveSwaggerApiScope({ AZURE_AD_CLIENT_ID: 'client-1' })).toBe('client-1/.default');
    });

    it('returns null when Entra ids are missing', () => {
      expect(resolveSwaggerApiScope({})).toBeNull();
    });
  });

  describe('resolveSwaggerOAuthUrls', () => {
    it('builds Entra v2 endpoints', () => {
      expect(resolveSwaggerOAuthUrls({ AZURE_AD_TENANT_ID: 'tenant-1' })).toEqual({
        authorizationUrl: 'https://login.microsoftonline.com/tenant-1/oauth2/v2.0/authorize',
        tokenUrl: 'https://login.microsoftonline.com/tenant-1/oauth2/v2.0/token',
      });
    });

    it('returns null without tenant', () => {
      expect(resolveSwaggerOAuthUrls({})).toBeNull();
    });
  });

  describe('resolveSwaggerOAuth2RedirectUrl', () => {
    it('uses AUTH_URL + /docs/oauth2-redirect.html', () => {
      expect(
        resolveSwaggerOAuth2RedirectUrl({
          AUTH_URL: 'https://api.plattform-kit.poc.singletonsd.com/',
        }),
      ).toBe('https://api.plattform-kit.poc.singletonsd.com/docs/oauth2-redirect.html');
    });

    it('prefers SWAGGER_OAUTH2_REDIRECT_URL', () => {
      expect(
        resolveSwaggerOAuth2RedirectUrl({
          SWAGGER_OAUTH2_REDIRECT_URL: 'http://localhost:3001/docs/oauth2-redirect.html',
          AUTH_URL: 'https://api.example.com',
        }),
      ).toBe('http://localhost:3001/docs/oauth2-redirect.html');
    });
  });

  describe('buildOpenApiDocumentConfig', () => {
    it('includes oauth2 with tenant-specific Entra URLs when configured', () => {
      const doc = buildOpenApiDocumentConfig({
        AZURE_AD_TENANT_ID: 'tenant-1',
        AZURE_AD_CLIENT_ID: 'client-1',
        AZURE_AD_API_AUDIENCE: 'api://platform-kit',
        AUTH_URL: 'https://api.example.com',
      });
      const schemes = doc.components?.securitySchemes ?? {};
      expect(schemes.bearer).toBeDefined();
      expect(schemes['x-tenant-id']).toBeDefined();
      expect(schemes.oauth2).toMatchObject({
        type: 'oauth2',
        flows: {
          authorizationCode: {
            authorizationUrl: 'https://login.microsoftonline.com/tenant-1/oauth2/v2.0/authorize',
            tokenUrl: 'https://api.example.com/docs/oauth2/token',
          },
        },
      });
    });

    it('falls back to common tenant for offline export without AZURE_AD_*', () => {
      const doc = buildOpenApiDocumentConfig({});
      expect(doc.components?.securitySchemes?.oauth2).toMatchObject({
        type: 'oauth2',
        flows: {
          authorizationCode: {
            authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
            tokenUrl: 'https://api.plattform-kit.poc.singletonsd.com/docs/oauth2/token',
          },
        },
      });
      expect(doc.components?.securitySchemes?.bearer).toBeDefined();
    });
  });

  describe('buildSwaggerUiOptions', () => {
    it('enables PKCE and prefills clientId', () => {
      const options = buildSwaggerUiOptions({
        AZURE_AD_CLIENT_ID: 'client-1',
        AZURE_AD_API_AUDIENCE: 'api://platform-kit',
        AUTH_URL: 'https://api.plattform-kit.poc.singletonsd.com',
      });
      expect(options.swaggerOptions).toMatchObject({
        persistAuthorization: true,
        oauth2RedirectUrl:
          'https://api.plattform-kit.poc.singletonsd.com/docs/oauth2-redirect.html',
        initOAuth: {
          clientId: 'client-1',
          usePkceWithAuthorizationCodeGrant: true,
          scopes: expect.arrayContaining(['openid', 'client-1/.default']),
        },
      });
      expect(options.customJsStr).toEqual(expect.stringContaining('BroadcastChannel'));
    });
  });
});
