import {
  SWAGGER_OAUTH2_CHANNEL,
  SWAGGER_OAUTH2_STORAGE_KEY,
  buildSwaggerOauth2BridgeScript,
  buildSwaggerOauth2RedirectHtml,
} from './swagger-oauth2-redirect';

describe('swagger-oauth2-redirect', () => {
  it('embeds BroadcastChannel fallback constants in redirect HTML', () => {
    const html = buildSwaggerOauth2RedirectHtml();
    expect(html).toContain(SWAGGER_OAUTH2_CHANNEL);
    expect(html).toContain(SWAGGER_OAUTH2_STORAGE_KEY);
    expect(html).toContain('BroadcastChannel');
    expect(html).toContain('swaggerUIRedirectOauth2');
  });

  it('bridge script listens for channel and storage events', () => {
    const script = buildSwaggerOauth2BridgeScript();
    expect(script).toContain(SWAGGER_OAUTH2_CHANNEL);
    expect(script).toContain('window.swaggerUIRedirectOauth2');
    expect(script).toContain('addEventListener');
  });
});
