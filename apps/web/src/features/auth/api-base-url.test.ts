import { apiUrl, resolveApiBaseUrl } from './api-base-url';

describe('resolveApiBaseUrl', () => {
  it('returns empty string when unset', () => {
    expect(resolveApiBaseUrl({})).toBe('');
  });

  it('strips trailing slashes', () => {
    expect(
      resolveApiBaseUrl({
        NEXT_PUBLIC_API_BASE_URL: 'https://api.plattform-kit.poc.singletonsd.com/',
      }),
    ).toBe('https://api.plattform-kit.poc.singletonsd.com');
  });
});

describe('apiUrl', () => {
  it('prefixes the API base when configured', () => {
    expect(
      apiUrl('/api/me', {
        NEXT_PUBLIC_API_BASE_URL: 'https://api.plattform-kit.poc.singletonsd.com',
      }),
    ).toBe('https://api.plattform-kit.poc.singletonsd.com/api/me');
  });

  it('falls back to a relative path when base is unset', () => {
    expect(apiUrl('/api/me', {})).toBe('/api/me');
  });
});
