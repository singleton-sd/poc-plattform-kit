import type { Express, NextFunction, Request, Response } from 'express';

type EnvBag = NodeJS.ProcessEnv | Record<string, string | undefined>;

function envTrim(env: EnvBag, key: string): string | undefined {
  const value = env[key]?.trim();
  return value || undefined;
}

/**
 * Token proxy path for Swagger OAuth2.
 * Default is same-origin relative so ACA PR hosts do not call prod AUTH_URL.
 */
export function resolveSwaggerTokenProxyUrl(env: EnvBag = process.env): string {
  return envTrim(env, 'SWAGGER_OAUTH2_TOKEN_URL') ?? '/docs/oauth2/token';
}

/** True when redirect_uri is allowed for the Swagger token proxy. */
export function isAllowedSwaggerOauth2RedirectUri(
  redirectUri: string,
  env: EnvBag = process.env,
): boolean {
  const allowed = allowedSwaggerOauth2RedirectUris(env);
  if (allowed.has(redirectUri)) {
    return true;
  }
  // Per-PR API previews: https://ssd-pocpk-aca-pr-<n>-ae.*.azurecontainerapps.io/...
  try {
    const url = new URL(redirectUri);
    if (url.protocol !== 'https:') {
      return false;
    }
    // Swagger at `/docs` may send `/oauth2-redirect.html` or `/docs/oauth2-redirect.html`.
    if (url.pathname !== '/docs/oauth2-redirect.html' && url.pathname !== '/oauth2-redirect.html') {
      return false;
    }
    return /^ssd-pocpk-aca-pr-\d+-ae\.[a-z0-9-]+\.australiaeast\.azurecontainerapps\.io$/i.test(
      url.hostname,
    );
  } catch {
    return false;
  }
}

export function allowedSwaggerOauth2RedirectUris(env: EnvBag = process.env): Set<string> {
  const uris = new Set<string>();
  const authUrl = envTrim(env, 'AUTH_URL')?.replace(/\/+$/, '');
  if (authUrl) {
    uris.add(`${authUrl}/docs/oauth2-redirect.html`);
  }
  const explicit = envTrim(env, 'SWAGGER_OAUTH2_REDIRECT_URL');
  if (explicit) {
    uris.add(explicit);
  }
  uris.add('http://localhost:3000/docs/oauth2-redirect.html');
  uris.add('http://localhost:3001/docs/oauth2-redirect.html');
  uris.add('https://api.plattform-kit.poc.singletonsd.com/docs/oauth2-redirect.html');
  return uris;
}

function readUrlEncodedBody(req: Request): Promise<Record<string, string>> {
  const existing = req.body;
  if (existing && typeof existing === 'object' && !Buffer.isBuffer(existing)) {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(existing as Record<string, unknown>)) {
      if (typeof value === 'string') {
        out[key] = value;
      }
    }
    if (Object.keys(out).length > 0) {
      return Promise.resolve(out);
    }
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      const params = new URLSearchParams(raw);
      const out: Record<string, string> = {};
      for (const [key, value] of params.entries()) {
        out[key] = value;
      }
      resolve(out);
    });
    req.on('error', reject);
  });
}

/**
 * Browser-safe token endpoint for Swagger Authorize.
 * Swagger UI cannot call Entra's token endpoint (CORS + needs client_secret);
 * this proxy adds the secret server-side and forwards the form body.
 */
export function mountSwaggerOauth2TokenProxy(expressApp: Express, env: EnvBag = process.env): void {
  expressApp.post(
    '/docs/oauth2/token',
    async (req: Request, res: Response, _next: NextFunction) => {
      const tenantId = envTrim(env, 'AZURE_AD_TENANT_ID');
      const clientId = envTrim(env, 'AZURE_AD_CLIENT_ID');
      const clientSecret = envTrim(env, 'AZURE_AD_CLIENT_SECRET');
      if (!tenantId || !clientId || !clientSecret) {
        res.status(503).json({ error: 'swagger_oauth_not_configured' });
        return;
      }

      let body: Record<string, string>;
      try {
        body = await readUrlEncodedBody(req);
      } catch {
        res.status(400).json({ error: 'invalid_body' });
        return;
      }

      const grantType = body.grant_type?.trim();
      if (grantType !== 'authorization_code') {
        res.status(400).json({ error: 'unsupported_grant_type' });
        return;
      }

      const redirectUri = body.redirect_uri?.trim();
      if (!redirectUri || !isAllowedSwaggerOauth2RedirectUri(redirectUri, env)) {
        res.status(400).json({ error: 'invalid_redirect_uri' });
        return;
      }

      const form = new URLSearchParams();
      form.set('grant_type', 'authorization_code');
      form.set('client_id', clientId);
      form.set('client_secret', clientSecret);
      form.set('code', body.code ?? '');
      form.set('redirect_uri', redirectUri);
      if (body.code_verifier) {
        form.set('code_verifier', body.code_verifier);
      }
      if (body.scope) {
        form.set('scope', body.scope);
      }

      const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
      try {
        const upstream = await fetch(tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: form.toString(),
        });
        const text = await upstream.text();
        res.status(upstream.status);
        res.setHeader('Cache-Control', 'no-store');
        const contentType = upstream.headers.get('content-type') || 'application/json';
        res.type(contentType).send(text);
      } catch {
        res.status(502).json({ error: 'token_upstream_failed' });
      }
    },
  );
}
