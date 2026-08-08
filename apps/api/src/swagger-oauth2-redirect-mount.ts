import type { Express, Request, Response } from 'express';
import { buildSwaggerOauth2RedirectHtml } from './swagger-oauth2-redirect';

/**
 * Override swagger-ui-dist oauth2-redirect.html (must register before
 * SwaggerModule.setup so Express matches this route first).
 * Omits COOP so the popup can still talk to /docs when browsers allow it.
 *
 * Also mounts `/oauth2-redirect.html`: Swagger UI at `/docs` (no trailing slash)
 * defaults redirect to `{origin}/oauth2-redirect.html`, not under `/docs/`.
 */
export function mountSwaggerOauth2Redirect(expressApp: Express): void {
  const html = buildSwaggerOauth2RedirectHtml();
  const sendRedirect = (_req: Request, res: Response) => {
    res.removeHeader('Cross-Origin-Opener-Policy');
    res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
    res.setHeader('Cache-Control', 'no-store');
    res.type('html').send(html);
  };
  expressApp.get('/docs/oauth2-redirect.html', sendRedirect);
  expressApp.get('/oauth2-redirect.html', sendRedirect);
}
