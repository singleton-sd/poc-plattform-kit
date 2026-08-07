import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildLoginScript, parseOrigins } from './login-script';

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

describe('buildLoginScript', () => {
  it('embeds authorization success payload for Decap handshake', () => {
    const html = buildLoginScript('github', 'success', { token: 'gho_test', provider: 'github' }, [
      'plattform-kit.poc.singletonsd.com',
    ]);
    assert.match(html, /authorization:github:success:/);
    assert.match(html, /gho_test/);
    assert.match(html, /authorizing:github/);
    assert.match(html, /plattform-kit\.poc\.singletonsd\.com/);
  });
});
