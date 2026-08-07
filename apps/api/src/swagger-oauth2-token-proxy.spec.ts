import type { Express, Request, Response } from 'express';
import {
  mountSwaggerOauth2TokenProxy,
  resolveSwaggerTokenProxyUrl,
} from './swagger-oauth2-token-proxy';

describe('resolveSwaggerTokenProxyUrl', () => {
  it('uses AUTH_URL + /docs/oauth2/token', () => {
    expect(
      resolveSwaggerTokenProxyUrl({ AUTH_URL: 'https://api.plattform-kit.poc.singletonsd.com/' }),
    ).toBe('https://api.plattform-kit.poc.singletonsd.com/docs/oauth2/token');
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
