import {
  DEFAULT_CORS_ORIGINS,
  isAuthRedirectOriginAllowed,
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
    'https://kind-rock-0f409fe00*.azurestaticapps.net',
  ];

  it('allows exact origins', () => {
    expect(isCorsOriginAllowed('https://app.plattform-kit.poc.singletonsd.com', allowlist)).toBe(
      true,
    );
  });

  it('allows this-repo SWA default and PR preview hosts', () => {
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

  it('rejects other tenants SWA hosts and non-https', () => {
    expect(isCorsOriginAllowed('https://other-app.7.azurestaticapps.net', allowlist)).toBe(false);
    expect(isCorsOriginAllowed('https://evil.example', allowlist)).toBe(false);
    expect(isCorsOriginAllowed('http://kind-rock-0f409fe00.7.azurestaticapps.net', allowlist)).toBe(
      false,
    );
  });

  it('honours open azurestaticapps suffix for CORS when configured', () => {
    expect(
      isCorsOriginAllowed('https://any-tenant.7.azurestaticapps.net', [
        'https://*.azurestaticapps.net',
      ]),
    ).toBe(true);
  });

  it('allows this-repo ACA web PR preview hosts', () => {
    const webPreview =
      'https://ssd-pocpk-aca-web-pr-190-ae.victoriouscliff-509c369b.australiaeast.azurecontainerapps.io';
    expect(isCorsOriginAllowed(webPreview, allowlist)).toBe(true);
    expect(isCorsOriginAllowed(webPreview, [...DEFAULT_CORS_ORIGINS])).toBe(true);
    expect(
      isCorsOriginAllowed(webPreview, ['https://ssd-pocpk-aca-web-pr-*.azurecontainerapps.io']),
    ).toBe(true);
  });

  it('rejects API ACA preview hosts and other container apps', () => {
    const apiPreview =
      'https://ssd-pocpk-aca-pr-190-ae.victoriouscliff-509c369b.australiaeast.azurecontainerapps.io';
    const otherApp =
      'https://some-other-app.victoriouscliff-509c369b.australiaeast.azurecontainerapps.io';
    expect(isCorsOriginAllowed(apiPreview, [...DEFAULT_CORS_ORIGINS])).toBe(false);
    expect(isCorsOriginAllowed(otherApp, [...DEFAULT_CORS_ORIGINS])).toBe(false);
  });
});

describe('isAuthRedirectOriginAllowed', () => {
  it('allows exact and instance-scoped SWA hosts', () => {
    const allowlist = [
      'https://app.example.test',
      'https://kind-rock-0f409fe00*.azurestaticapps.net',
    ];
    expect(isAuthRedirectOriginAllowed('https://app.example.test', allowlist)).toBe(true);
    expect(
      isAuthRedirectOriginAllowed(
        'https://kind-rock-0f409fe00-57.eastasia.7.azurestaticapps.net',
        allowlist,
      ),
    ).toBe(true);
  });

  it('rejects open multi-tenant azurestaticapps wildcards', () => {
    expect(
      isAuthRedirectOriginAllowed('https://attacker.7.azurestaticapps.net', [
        'https://*.azurestaticapps.net',
      ]),
    ).toBe(false);
  });

  it('allows scoped ACA web PR hosts and rejects open ACA suffixes', () => {
    const webPreview =
      'https://ssd-pocpk-aca-web-pr-190-ae.victoriouscliff-509c369b.australiaeast.azurecontainerapps.io';
    const apiPreview =
      'https://ssd-pocpk-aca-pr-190-ae.victoriouscliff-509c369b.australiaeast.azurecontainerapps.io';
    expect(isAuthRedirectOriginAllowed(webPreview, [...DEFAULT_CORS_ORIGINS])).toBe(true);
    expect(isAuthRedirectOriginAllowed(webPreview, ['https://*.azurecontainerapps.io'])).toBe(true);
    expect(isAuthRedirectOriginAllowed(apiPreview, ['https://*.azurecontainerapps.io'])).toBe(
      false,
    );
    expect(isAuthRedirectOriginAllowed(apiPreview, [...DEFAULT_CORS_ORIGINS])).toBe(false);
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
