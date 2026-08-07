import {
  DEFAULT_CORS_ORIGINS,
  isCorsOriginAllowed,
  parseCorsOrigins,
  resolveCorsOrigin,
} from './cors-origins';

describe('parseCorsOrigins', () => {
  it('returns locked defaults when env is missing or blank', () => {
    expect(parseCorsOrigins(undefined)).toEqual([...DEFAULT_CORS_ORIGINS]);
    expect(parseCorsOrigins('')).toEqual([...DEFAULT_CORS_ORIGINS]);
    expect(parseCorsOrigins('   ')).toEqual([...DEFAULT_CORS_ORIGINS]);
  });

  it('splits comma-separated origins and trims', () => {
    expect(parseCorsOrigins(' https://a.example ,https://b.example ')).toEqual([
      'https://a.example',
      'https://b.example',
    ]);
  });
});

describe('isCorsOriginAllowed', () => {
  const allowlist = [
    'https://app.plattform-kit.poc.singletonsd.com',
    'https://*.azurestaticapps.net',
  ];

  it('allows exact origins', () => {
    expect(isCorsOriginAllowed('https://app.plattform-kit.poc.singletonsd.com', allowlist)).toBe(
      true,
    );
  });

  it('allows SWA default and PR preview hosts via wildcard', () => {
    expect(
      isCorsOriginAllowed('https://kind-rock-0f409fe00.7.azurestaticapps.net', allowlist),
    ).toBe(true);
    expect(
      isCorsOriginAllowed(
        'https://kind-rock-0f409fe00-57.eastasia.7.azurestaticapps.net',
        allowlist,
      ),
    ).toBe(true);
  });

  it('rejects non-allowlisted and non-https origins', () => {
    expect(isCorsOriginAllowed('https://evil.example', allowlist)).toBe(false);
    expect(isCorsOriginAllowed('http://kind-rock-0f409fe00.7.azurestaticapps.net', allowlist)).toBe(
      false,
    );
    expect(isCorsOriginAllowed('not-a-url', allowlist)).toBe(false);
  });
});

describe('resolveCorsOrigin', () => {
  it('allows missing Origin and allowlisted Origin', () => {
    const decisions: Array<boolean | undefined> = [];
    resolveCorsOrigin(undefined, (_err, allow) => decisions.push(allow), 'https://app.example');
    resolveCorsOrigin(
      'https://app.example',
      (_err, allow) => decisions.push(allow),
      'https://app.example',
    );
    resolveCorsOrigin(
      'https://nope.example',
      (_err, allow) => decisions.push(allow),
      'https://app.example',
    );
    expect(decisions).toEqual([true, true, false]);
  });
});
