import type { Express, Request, Response } from 'express';
import { buildSwaggerOauth2RedirectHtml } from './swagger-oauth2-redirect';

/**
 * Override swagger-ui-dist oauth2-redirect.html (must register before
 * SwaggerModule.setup so Express matches this route first).
 * Omits COOP so the popup can still talk to /docs when browsers allow it.
 */
export function mountSwaggerOauth2Redirect(expressApp: Express): void {
  const html = buildSwaggerOauth2RedirectHtml();
  expressApp.get('/docs/oauth2-redirect.html', (_req: Request, res: Response) => {
    res.removeHeader('Cross-Origin-Opener-Policy');
    res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
    res.setHeader('Cache-Control', 'no-store');
    res.type('html').send(html);
  });
}
