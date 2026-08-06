import { apiUrl, getApiBaseUrl } from './api-base';

describe('api-base', () => {
  const previous = process.env.NEXT_PUBLIC_API_BASE_URL;

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.NEXT_PUBLIC_API_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_API_BASE_URL = previous;
    }
  });

  it('returns empty base when unset', () => {
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    expect(getApiBaseUrl()).toBe('');
    expect(apiUrl('/api/me')).toBe('/api/me');
  });

  it('strips trailing slash and prefixes paths', () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.example.test/';
    expect(getApiBaseUrl()).toBe('https://api.example.test');
    expect(apiUrl('/api/me')).toBe('https://api.example.test/api/me');
  });
});
