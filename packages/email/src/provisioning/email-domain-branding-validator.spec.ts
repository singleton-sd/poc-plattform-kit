import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  validateBimiSvgStructure,
  validateEmailDomainBranding,
} from './email-domain-branding-validator';

describe('validateBimiSvgStructure', () => {
  it('accepts a tiny-ps BIMI SVG', () => {
    const svg = '<svg version="1.2" baseProfile="tiny-ps" viewBox="0 0 100 100"></svg>';
    assert.deepEqual(validateBimiSvgStructure(svg), []);
  });

  it('rejects disallowed structure', () => {
    const svg = '<svg viewBox="0 0 100 100"><script>alert(1)</script></svg>';
    const issues = validateBimiSvgStructure(svg);
    assert.ok(issues.some((issue) => issue.includes('baseProfile')));
    assert.ok(issues.some((issue) => issue.includes('version')));
    assert.ok(issues.some((issue) => issue.includes('<script>')));
  });
});

describe('validateEmailDomainBranding', () => {
  const config = {
    domain: 'mail.example.com',
    dkimSelector: 'fe-test',
    expectedDmarcPolicy: 'reject' as const,
    bimiSelector: 'default',
    expectedBimiLogoUrl: 'https://assets.example.com/logo.svg',
  };

  function resolver(records: Record<string, string[]>) {
    return async (hostname: string): Promise<string[]> => records[hostname] ?? [];
  }

  it('passes with valid DNS, logo URL, and BIMI SVG', async () => {
    const report = await validateEmailDomainBranding(config, {
      dnsResolveTxt: resolver({
        'mail.example.com': ['v=spf1 include:spf.forwardemail.net -all'],
        'fe-test._domainkey.mail.example.com': ['v=DKIM1; k=rsa; p=AAA'],
        '_dmarc.mail.example.com': ['v=DMARC1; p=reject; rua=mailto:dmarc@example.com'],
        'default._bimi.mail.example.com': ['v=BIMI1; l=https://assets.example.com/logo.svg;'],
      }),
      fetchImpl: async () =>
        new Response('<svg version="1.2" baseProfile="tiny-ps" viewBox="0 0 100 100"></svg>', {
          status: 200,
        }),
    });

    assert.equal(report.ok, true);
    assert.equal(report.errors.length, 0);
    assert.ok(report.checks.every((check) => check.status === 'pass' || check.status === 'warn'));
  });

  it('fails with actionable messages when DNS is missing', async () => {
    const report = await validateEmailDomainBranding(config, {
      dnsResolveTxt: resolver({}),
      fetchImpl: async () => new Response('missing', { status: 404, statusText: 'Not Found' }),
    });

    assert.equal(report.ok, false);
    assert.ok(report.errors.some((error) => error.includes('SPF TXT record')));
    assert.ok(report.errors.some((error) => error.includes('DKIM TXT record')));
    assert.ok(report.errors.some((error) => error.includes('DMARC TXT record')));
    assert.ok(report.errors.some((error) => error.includes('BIMI TXT record')));
  });

  it('fails on DMARC policy mismatch and BIMI logo URL mismatch', async () => {
    const report = await validateEmailDomainBranding(config, {
      dnsResolveTxt: resolver({
        'mail.example.com': ['v=spf1 include:spf.forwardemail.net -all'],
        'fe-test._domainkey.mail.example.com': ['v=DKIM1; p=AAA'],
        '_dmarc.mail.example.com': ['v=DMARC1; p=quarantine'],
        'default._bimi.mail.example.com': ['v=BIMI1; l=https://cdn.example.com/logo.svg;'],
      }),
      fetchImpl: async () => new Response('unused', { status: 200 }),
    });

    assert.equal(report.ok, false);
    assert.ok(report.errors.some((error) => error.includes('DMARC policy mismatch')));
    assert.ok(report.errors.some((error) => error.includes('BIMI logo URL mismatch')));
  });
});
