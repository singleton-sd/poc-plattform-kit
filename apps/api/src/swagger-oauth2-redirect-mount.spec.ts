import type { Express, Request, Response } from 'express';
import { mountSwaggerOauth2Redirect } from './swagger-oauth2-redirect-mount';
import { SWAGGER_OAUTH2_CHANNEL } from './swagger-oauth2-redirect';

describe('mountSwaggerOauth2Redirect', () => {
  it('registers GET /docs/oauth2-redirect.html without COOP same-origin', () => {
    const handlers: Record<string, (req: Request, res: Response) => void> = {};
    const expressApp = {
      get: (path: string, handler: (req: Request, res: Response) => void) => {
        handlers[path] = handler;
      },
    } as unknown as Express;

    mountSwaggerOauth2Redirect(expressApp);

    const headers: Record<string, string> = {};
    const res = {
      removeHeader: jest.fn(),
      setHeader: (name: string, value: string) => {
        headers[name] = value;
      },
      type: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    handlers['/docs/oauth2-redirect.html']({} as Request, res as unknown as Response);

    expect(res.removeHeader).toHaveBeenCalledWith('Cross-Origin-Opener-Policy');
    expect(headers['Cross-Origin-Opener-Policy']).toBe('unsafe-none');
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining(SWAGGER_OAUTH2_CHANNEL));
  });
});
