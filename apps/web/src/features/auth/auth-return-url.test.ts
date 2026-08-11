import { captureReturnUrl, getAndClearReturnUrl, sanitizeReturnUrl } from './auth-return-url';

describe('auth-return-url utilities', () => {
  const realLocation = global.location;

  beforeEach(() => {
    // mock location origin/path
    // @ts-ignore
    delete (global as any).location;
    // @ts-ignore
    global.location = {
      origin: 'https://app.test',
      pathname: '/current',
      search: '?a=1',
      hash: '#x',
    } as any;
    sessionStorage.clear();
  });

  afterEach(() => {
    // @ts-ignore
    global.location = realLocation;
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
    const inUrl = 'https://app.test/some/page?b=2#z';
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
