import type { Express, Request, Response } from 'express';

/** Redirect API origin root to Swagger UI. */
export function mountApiRootDocsRedirect(expressApp: Express): void {
  expressApp.get('/', (_req: Request, res: Response) => {
    res.redirect(302, '/docs');
  });
}
