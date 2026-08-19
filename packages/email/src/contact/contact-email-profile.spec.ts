import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  extractEmailDomain,
  loadContactEmailProfile,
  validateContactEmailProfile,
} from './contact-email-profile';

describe('loadContactEmailProfile', () => {
  it('derives sending domain from from-address when unset', () => {
    const profile = loadContactEmailProfile({
      EMAIL_FROM_ADDRESS: 'noreply@mail.example.test',
    });
    assert.equal(profile.sendingDomain, 'mail.example.test');
    assert.equal(profile.dmarcPolicy, 'quarantine');
  });

  it('honours explicit domain and DMARC policy', () => {
    const profile = loadContactEmailProfile({
      EMAIL_FROM_ADDRESS: 'noreply@mail.example.test',
      EMAIL_SENDING_DOMAIN: 'mail.brand.test',
      EMAIL_DMARC_POLICY: 'reject',
      EMAIL_DMARC_RUA: 'mailto:dmarc-reports@example.test',
    });
    assert.equal(profile.sendingDomain, 'mail.brand.test');
    assert.equal(profile.dmarcPolicy, 'reject');
    assert.equal(profile.dmarcAggregateReportAddress, 'mailto:dmarc-reports@example.test');
  });
});

describe('validateContactEmailProfile', () => {
  it('rejects misaligned from-address domain', () => {
    const errors = validateContactEmailProfile(
      loadContactEmailProfile({
        EMAIL_FROM_ADDRESS: 'noreply@other-domain.test',
        EMAIL_SENDING_DOMAIN: 'mail.example.test',
      }),
    );
    assert.ok(errors.some((error) => error.includes('must align')));
  });

  it('requires mailto prefix for DMARC rua', () => {
    const errors = validateContactEmailProfile(
      loadContactEmailProfile({
        EMAIL_FROM_ADDRESS: 'noreply@mail.example.test',
        EMAIL_SENDING_DOMAIN: 'mail.example.test',
        EMAIL_DMARC_RUA: 'dmarc@example.test',
      }),
    );
    assert.ok(errors.some((error) => error.includes('mailto')));
  });
});

describe('extractEmailDomain', () => {
  it('returns null for malformed values', () => {
    assert.equal(extractEmailDomain(''), null);
    assert.equal(extractEmailDomain('no-at-sign'), null);
    assert.equal(extractEmailDomain('foo@'), null);
  });
});
