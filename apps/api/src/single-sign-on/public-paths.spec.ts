import { isPublicPath } from './public-paths';

describe('isPublicPath', () => {
  it.each([
    '/',
    '/health',
    '/health/',
    '/api/auth',
    '/api/auth/callback/microsoft-entra-id',
    '/docs',
    '/docs/',
    '/docs/oauth2-redirect.html',
    '/oauth2-redirect.html',
    '/docs-json',
  ])('allows %s', (path) => {
    expect(isPublicPath(path)).toBe(true);
  });

  it.each(['/api/me', '/tenants', '/tenants/abc', ''])('rejects %s', (path) => {
    expect(isPublicPath(path)).toBe(false);
  });
});
