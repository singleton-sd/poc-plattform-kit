import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildLoginScript, isAllowedOauthHostname, parseOrigins } from './login-script';

describe('parseOrigins', () => {
  it('splits and trims hostnames', () => {
    assert.deepEqual(parseOrigins('a.example.com, localhost:4321 '), [
      'a.example.com',
      'localhost:4321',
    ]);
  });

  it('rejects empty ORIGINS', () => {
    assert.throws(() => parseOrigins(''), /ORIGINS/);
    assert.throws(() => parseOrigins(undefined), /ORIGINS/);
  });
});

describe('isAllowedOauthHostname', () => {
  const marketingSwa = 'purple-field-05048bf00*.azurestaticapps.net';
  const allowlist = ['plattform-kit.poc.singletonsd.com', marketingSwa, 'localhost:4321'];

  it('allows exact custom-domain and localhost hosts', () => {
    assert.equal(isAllowedOauthHostname('plattform-kit.poc.singletonsd.com', allowlist), true);
    assert.equal(isAllowedOauthHostname('localhost:4321', allowlist), true);
  });

  it('allows marketing SWA default and PR preview hosts', () => {
    assert.equal(
      isAllowedOauthHostname('purple-field-05048bf00.7.azurestaticapps.net', allowlist),
      true,
    );
    assert.equal(
      isAllowedOauthHostname('purple-field-05048bf00-91.eastasia.7.azurestaticapps.net', allowlist),
      true,
    );
  });

  it('rejects other SWA instances and open multi-tenant wildcards', () => {
    assert.equal(
      isAllowedOauthHostname('kind-rock-0f409fe00-57.eastasia.7.azurestaticapps.net', allowlist),
      false,
    );
    assert.equal(
      isAllowedOauthHostname('attacker.7.azurestaticapps.net', ['*.azurestaticapps.net']),
      false,
    );
  });
});

describe('buildLoginScript', () => {
  it('embeds authorization success payload for Decap handshake', () => {
    const html = buildLoginScript('github', 'success', { token: 'gho_test', provider: 'github' }, [
      'plattform-kit.poc.singletonsd.com',
      'purple-field-05048bf00*.azurestaticapps.net',
    ]);
    assert.match(html, /authorization:github:success:/);
    assert.match(html, /gho_test/);
    assert.match(html, /authorizing:github/);
    assert.match(html, /plattform-kit\.poc\.singletonsd\.com/);
    assert.match(html, /purple-field-05048bf00\*\.azurestaticapps\.net/);
    assert.match(html, /swaMarker/);
  });
});
