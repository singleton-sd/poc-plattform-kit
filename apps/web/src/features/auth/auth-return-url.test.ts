import { captureReturnUrl, getAndClearReturnUrl, sanitizeReturnUrl } from './auth-return-url';

describe('auth-return-url utilities', () => {
  beforeEach(() => {
    // Use the history API to set pathname/search/hash in jsdom without redefining window.location.
    window.history.replaceState({}, '', '/current?a=1#x');
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('captures and returns the current path and clears it', () => {
    captureReturnUrl();
    expect(sessionStorage.getItem('pocpk:returnTo')).toBe('/current?a=1#x');

    const v = getAndClearReturnUrl();
    expect(v).toBe('/current?a=1#x');
    expect(sessionStorage.getItem('pocpk:returnTo')).toBeNull();
  });

  it('sanitizes same-origin absolute urls to path', () => {
    const inUrl = `${window.location.origin}/some/page?b=2#z`;
    expect(sanitizeReturnUrl(inUrl)).toBe('/some/page?b=2#z');
  });

  it('rejects different-origin absolute urls', () => {
    expect(sanitizeReturnUrl('https://evil.com/')).toBeNull();
  });

  it('rejects protocol-relative urls', () => {
    expect(sanitizeReturnUrl('//evil.com/')).toBeNull();
  });

  it('rejects relative non-slash paths', () => {
    expect(sanitizeReturnUrl('javascript:alert(1)')).toBeNull();
  });

  it('allows root slash path and normalizes empty to /', () => {
    expect(sanitizeReturnUrl('/')).toBe('/');
    expect(sanitizeReturnUrl('/javascript:foo')).toBeNull();
  });
});
