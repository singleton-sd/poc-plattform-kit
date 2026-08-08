import { buildThrottleConfig, generateApiThrottleKey } from './http-hardening';

describe('generateApiThrottleKey', () => {
  it('shares one named bucket across controllers and handlers', () => {
    const firstContext = {} as never;
    const secondContext = {} as never;

    expect(generateApiThrottleKey(firstContext, '203.0.113.10', 'default')).toBe(
      generateApiThrottleKey(secondContext, '203.0.113.10', 'default'),
    );
    expect(generateApiThrottleKey(firstContext, '203.0.113.11', 'default')).not.toBe(
      generateApiThrottleKey(firstContext, '203.0.113.10', 'default'),
    );
  });
});

describe('buildThrottleConfig', () => {
  it('uses a 100 request per minute default', () => {
    expect(buildThrottleConfig({})).toMatchObject({ ttl: 60_000, limit: 100 });
  });

  it('accepts positive integer environment overrides', () => {
    expect(
      buildThrottleConfig({
        API_THROTTLE_TTL_MS: '30000',
        API_THROTTLE_LIMIT: '25',
      }),
    ).toMatchObject({ ttl: 30_000, limit: 25 });
  });

  it.each([
    ['API_THROTTLE_TTL_MS', '0'],
    ['API_THROTTLE_TTL_MS', '1.5'],
    ['API_THROTTLE_LIMIT', '-1'],
    ['API_THROTTLE_LIMIT', 'many'],
  ])('rejects invalid %s values', (name, value) => {
    expect(() => buildThrottleConfig({ [name]: value })).toThrow(
      `${name} must be a positive integer`,
    );
  });
});
