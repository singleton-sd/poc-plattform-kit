import type { Express, Request, Response } from 'express';
import {
  isAllowedSwaggerOauth2RedirectUri,
  mountSwaggerOauth2TokenProxy,
  resolveSwaggerTokenProxyUrl,
} from './swagger-oauth2-token-proxy';

describe('resolveSwaggerTokenProxyUrl', () => {
  it('uses same-origin relative path so ACA previews do not hit prod', () => {
    expect(
      resolveSwaggerTokenProxyUrl({ AUTH_URL: 'https://api.plattform-kit.poc.singletonsd.com/' }),
    ).toBe('/docs/oauth2/token');
  });
});

describe('isAllowedSwaggerOauth2RedirectUri', () => {
  it('allows localhost docs redirect', () => {
    expect(
      isAllowedSwaggerOauth2RedirectUri('http://localhost:3000/docs/oauth2-redirect.html'),
    ).toBe(true);
  });

  it('allows prod API docs redirect', () => {
    expect(
      isAllowedSwaggerOauth2RedirectUri(
        'https://api.plattform-kit.poc.singletonsd.com/docs/oauth2-redirect.html',
      ),
    ).toBe(true);
  });

  it('allows ACA PR preview docs redirect', () => {
    expect(
      isAllowedSwaggerOauth2RedirectUri(
        'https://ssd-pocpk-aca-pr-82-ae.victoriouscliff-509c369b.australiaeast.azurecontainerapps.io/docs/oauth2-redirect.html',
      ),
    ).toBe(true);
  });

  it('allows ACA PR preview Swagger-default /oauth2-redirect.html', () => {
    expect(
      isAllowedSwaggerOauth2RedirectUri(
        'https://ssd-pocpk-aca-pr-82-ae.victoriouscliff-509c369b.australiaeast.azurecontainerapps.io/oauth2-redirect.html',
      ),
    ).toBe(true);
  });

  it('rejects unrelated hosts', () => {
    expect(
      isAllowedSwaggerOauth2RedirectUri('https://evil.example/docs/oauth2-redirect.html'),
    ).toBe(false);
  });
});

describe('mountSwaggerOauth2TokenProxy', () => {
  it('rejects non-authorization_code grants', async () => {
    let handler: ((req: Request, res: Response) => Promise<void>) | undefined;

    const expressApp = {
      post: (_path: string, routeHandler: (req: Request, res: Response) => Promise<void>) => {
        handler = routeHandler;
      },
    } as unknown as Express;

    mountSwaggerOauth2TokenProxy(expressApp, {
      AZURE_AD_TENANT_ID: 'tenant',
      AZURE_AD_CLIENT_ID: 'client',
      AZURE_AD_CLIENT_SECRET: 'secret',
      AUTH_URL: 'https://api.example.com',
    });

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    await handler!(
      { body: { grant_type: 'client_credentials' } } as unknown as Request,
      res as unknown as Response,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'unsupported_grant_type' });
  });
});
