import type { Express, Request, Response } from 'express';
import { mountSwaggerOauth2Redirect } from './swagger-oauth2-redirect-mount';
import { SWAGGER_OAUTH2_CHANNEL } from './swagger-oauth2-redirect';

describe('mountSwaggerOauth2Redirect', () => {
  it.each(['/docs/oauth2-redirect.html', '/oauth2-redirect.html'])(
    'registers GET %s without COOP same-origin',
    (path) => {
      const handlers: Record<string, (req: Request, res: Response) => void> = {};
      const expressApp = {
        get: (route: string, handler: (req: Request, res: Response) => void) => {
          handlers[route] = handler;
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

      handlers[path]!({} as Request, res as unknown as Response);

      expect(res.removeHeader).toHaveBeenCalledWith('Cross-Origin-Opener-Policy');
      expect(headers['Cross-Origin-Opener-Policy']).toBe('unsafe-none');
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining(SWAGGER_OAUTH2_CHANNEL));
    },
  );
});
