import type { Express, Request, Response } from 'express';
import { mountApiRootDocsRedirect } from './docs-root-redirect';

describe('mountApiRootDocsRedirect', () => {
  it('registers GET / that redirects to /docs', () => {
    const handlers: Record<string, (req: Request, res: Response) => void> = {};
    const expressApp = {
      get: (path: string, handler: (req: Request, res: Response) => void) => {
        handlers[path] = handler;
      },
    } as unknown as Express;

    mountApiRootDocsRedirect(expressApp);

    const redirect = jest.fn();
    handlers['/']({} as Request, { redirect } as unknown as Response);

    expect(redirect).toHaveBeenCalledWith(302, '/docs');
  });
});
