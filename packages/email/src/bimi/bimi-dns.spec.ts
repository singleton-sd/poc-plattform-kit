import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildBimiDnsRecordName,
  buildBimiSelectorHeaderValue,
  buildBimiTxtValue,
  assertValidBimiSelector,
} from './bimi-dns';

describe('assertValidBimiSelector', () => {
  it('accepts default', () => {
    assert.equal(assertValidBimiSelector('default'), 'default');
  });

  it('accepts common DNS-safe selectors', () => {
    assert.equal(assertValidBimiSelector('brand1'), 'brand1');
    assert.equal(assertValidBimiSelector('alt.logo'), 'alt.logo');
    assert.equal(assertValidBimiSelector('acme_brand'), 'acme_brand');
  });

  it('rejects empty/whitespace', () => {
    assert.throws(() => assertValidBimiSelector('   '), /required/i);
  });

  it('rejects invalid characters', () => {
    assert.throws(() => assertValidBimiSelector('bad!/x'), /Invalid BIMI selector/i);
  });
});

describe('buildBimiDnsRecordName / buildBimiTxtValue', () => {
  it('builds record name using selector._bimi.sendingDomain', () => {
    assert.equal(
      buildBimiDnsRecordName({
        selector: 'default',
        sendingDomain: 'mail.example.com',
        logoUrl: 'https://cdn.example.com/logo.svg',
      }),
      'default._bimi.mail.example.com',
    );
  });

  it('builds TXT value with an empty a= tag when evidenceUrl omitted', () => {
    assert.equal(
      buildBimiTxtValue({
        selector: 'default',
        sendingDomain: 'mail.example.com',
        logoUrl: 'https://cdn.example.com/logo.svg',
      }),
      'v=BIMI1; l=https://cdn.example.com/logo.svg; a=',
    );
  });

  it('builds TXT value with evidenceUrl when provided', () => {
    assert.equal(
      buildBimiTxtValue({
        selector: 'alt',
        sendingDomain: 'mail.example.com',
        logoUrl: 'https://cdn.example.com/logo.svg',
        evidenceUrl: 'https://cdn.example.com/bimi/vmc.pem',
      }),
      'v=BIMI1; l=https://cdn.example.com/logo.svg; a=https://cdn.example.com/bimi/vmc.pem',
    );
  });

  it('rejects non-HTTPS logo URLs', () => {
    assert.throws(() =>
      buildBimiTxtValue({
        selector: 'default',
        sendingDomain: 'mail.example.com',
        logoUrl: 'http://cdn.example.com/logo.svg',
      }),
    );
  });
});

describe('buildBimiSelectorHeaderValue', () => {
  it('formats a BIMI-Selector header value', () => {
    assert.equal(buildBimiSelectorHeaderValue('mySelector'), 'v=BIMI1; s=mySelector');
  });
});
