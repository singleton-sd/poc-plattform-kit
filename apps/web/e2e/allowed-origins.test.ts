import {
  collectAllowedOrigins,
  isAllowedPlaywrightRequestUrl,
  resolvePlaywrightBaseUrl,
} from './allowed-origins';

describe('resolvePlaywrightBaseUrl', () => {
  it('defaults to the local static-export server', () => {
    expect(resolvePlaywrightBaseUrl({})).toBe('http://127.0.0.1:4173');
  });

  it('strips a trailing slash from PLAYWRIGHT_BASE_URL', () => {
    expect(
      resolvePlaywrightBaseUrl({
        PLAYWRIGHT_BASE_URL: 'https://kind-rock-0f409fe00-76.eastasia.7.azurestaticapps.net/',
      }),
    ).toBe('https://kind-rock-0f409fe00-76.eastasia.7.azurestaticapps.net');
  });
});

describe('collectAllowedOrigins', () => {
  it('always includes loopback origins used by the local server', () => {
    expect(collectAllowedOrigins('http://127.0.0.1:4173')).toEqual(
      expect.arrayContaining(['http://127.0.0.1:4173', 'http://localhost:4173']),
    );
  });

  it('includes a configured trusted preview origin', () => {
    const preview = 'https://kind-rock-0f409fe00-76.eastasia.7.azurestaticapps.net';
    expect(collectAllowedOrigins(preview)).toEqual(
      expect.arrayContaining([preview, 'http://127.0.0.1:4173', 'http://localhost:4173']),
    );
  });
});

describe('isAllowedPlaywrightRequestUrl', () => {
  const localOrigins = collectAllowedOrigins('http://127.0.0.1:4173');
  const previewOrigin = 'https://kind-rock-0f409fe00-76.eastasia.7.azurestaticapps.net';
  const previewOrigins = collectAllowedOrigins(previewOrigin);

  it('allows the local application origin', () => {
    expect(isAllowedPlaywrightRequestUrl('http://127.0.0.1:4173/changelog', localOrigins)).toBe(
      true,
    );
  });

  it('allows the configured preview origin when PLAYWRIGHT_BASE_URL is set', () => {
    expect(isAllowedPlaywrightRequestUrl(`${previewOrigin}/`, previewOrigins)).toBe(true);
  });

  it('blocks production and third-party hosts', () => {
    expect(
      isAllowedPlaywrightRequestUrl('https://plattform-kit.poc.singletonsd.com/', previewOrigins),
    ).toBe(false);
    expect(
      isAllowedPlaywrightRequestUrl('https://login.microsoftonline.com/common', previewOrigins),
    ).toBe(false);
  });

  it('allows non-http schemes used by the browser', () => {
    expect(isAllowedPlaywrightRequestUrl('data:text/plain,ok', localOrigins)).toBe(true);
  });
});
