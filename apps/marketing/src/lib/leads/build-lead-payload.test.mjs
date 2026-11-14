import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildLeadPayload,
  isLeadBodyWithinLimit,
  normaliseEmail,
  serializeLeadPayload,
  validateLeadValues,
} from './build-lead-payload.mjs';
import {
  LEAD_BODY_MAX_BYTES,
  LEAD_CONSENT_TEXT_VERSION,
  LEAD_PRODUCT,
  LEAD_SOURCE_SITE,
  createSubmissionId,
  isUuidV4,
  utf8ByteLength,
} from './lead-config.mjs';

const SUBMISSION_ID = '550e8400-e29b-41d4-a716-446655440000';

function baseValues(overrides = {}) {
  return {
    name: 'Ada Lovelace',
    email: 'Ada@Example.COM',
    consent: true,
    marketingOptIn: false,
    ...overrides,
  };
}

test('createSubmissionId returns a UUID v4', () => {
  const id = createSubmissionId();
  assert.equal(isUuidV4(id), true);
  assert.notEqual(id, createSubmissionId());
});

test('normaliseEmail trims and lowercases at the submit boundary', () => {
  assert.equal(normaliseEmail('  Ada@Example.COM  '), 'ada@example.com');
});

test('contact payload matches the job-kit schema keys and enums', () => {
  const payload = buildLeadPayload({
    formType: 'contact',
    submissionId: SUBMISSION_ID,
    turnstileToken: 'turnstile-token',
    sourcePage: '/contact',
    values: baseValues({
      company: '  Analytical Engines  ',
      phone: ' +61 400 000 000 ',
      message: '  Please get in touch.  ',
    }),
  });

  assert.deepEqual(payload, {
    sourceSite: LEAD_SOURCE_SITE,
    sourcePage: '/contact',
    submissionId: SUBMISSION_ID,
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    company: 'Analytical Engines',
    phone: '+61 400 000 000',
    consent: true,
    consentTextVersion: LEAD_CONSENT_TEXT_VERSION,
    marketingOptIn: false,
    turnstileToken: 'turnstile-token',
    formType: 'contact',
    product: LEAD_PRODUCT,
    message: 'Please get in touch.',
  });
  assert.equal(LEAD_SOURCE_SITE, 'https://plattform-kit.poc.singletonsd.com');
  assert.equal(LEAD_PRODUCT, 'platform_kit');
  assert.equal(payload.consent, true);
  assert.equal('source' in payload, false);
  assert.equal('cf-turnstile-response' in payload, false);
  assert.equal('isTest' in payload, false);
  assert.equal('website' in payload, false);
  assert.equal('feature' in payload, false);
});

test('waitlist payload requires product and includes feature', () => {
  const payload = buildLeadPayload({
    formType: 'waitlist',
    submissionId: SUBMISSION_ID,
    turnstileToken: 'turnstile-token',
    sourcePage: '/waitlist',
    values: baseValues({ feature: '  early_access  ' }),
  });

  assert.equal(payload.formType, 'waitlist');
  assert.equal(payload.product, 'platform_kit');
  assert.equal(payload.feature, 'early_access');
  assert.equal('message' in payload, false);
  assert.deepEqual(
    Object.keys(payload).sort(),
    [
      'consent',
      'consentTextVersion',
      'email',
      'feature',
      'formType',
      'marketingOptIn',
      'name',
      'product',
      'sourcePage',
      'sourceSite',
      'submissionId',
      'turnstileToken',
    ].sort(),
  );
});

test('empty optional fields are omitted; filled honeypot is kept', () => {
  const clean = buildLeadPayload({
    formType: 'contact',
    submissionId: SUBMISSION_ID,
    turnstileToken: 'tok',
    values: baseValues({ message: 'Hello there.', website: '   ' }),
  });
  assert.equal('website' in clean, false);
  assert.equal('company' in clean, false);
  assert.equal('phone' in clean, false);

  const spam = buildLeadPayload({
    formType: 'contact',
    submissionId: SUBMISSION_ID,
    turnstileToken: 'tok',
    values: baseValues({ message: 'Hello there.', website: 'https://spam.test' }),
  });
  assert.equal(spam.website, 'https://spam.test');
});

test('marketingOptIn stays false unless the box is checked', () => {
  const off = buildLeadPayload({
    formType: 'waitlist',
    submissionId: SUBMISSION_ID,
    turnstileToken: 'tok',
    values: baseValues({ feature: 'early_access' }),
  });
  assert.equal(off.marketingOptIn, false);

  const on = buildLeadPayload({
    formType: 'waitlist',
    submissionId: SUBMISSION_ID,
    turnstileToken: 'tok',
    values: baseValues({ feature: 'early_access', marketingOptIn: true }),
  });
  assert.equal(on.marketingOptIn, true);
});

test('serialized body stays under the 16 KB gateway limit', () => {
  const payload = buildLeadPayload({
    formType: 'contact',
    submissionId: SUBMISSION_ID,
    turnstileToken: 't'.repeat(2048),
    sourcePage: '/contact',
    values: baseValues({ message: 'm'.repeat(4000) }),
  });
  const body = serializeLeadPayload(payload);
  assert.equal(isLeadBodyWithinLimit(body), true);
  assert.ok(utf8ByteLength(body) <= LEAD_BODY_MAX_BYTES);
});

test('validateLeadValues blocks missing required fields before fetch', () => {
  const errors = validateLeadValues('contact', {
    name: '  ',
    email: 'not-an-email',
    message: '',
    consent: false,
  });
  assert.equal(errors.name, 'Enter your first and last name.');
  assert.equal(errors.email, 'Enter a valid email address.');
  assert.equal(errors.message, 'Enter a message.');
  assert.equal(errors.consent, 'Please accept the privacy notice.');

  const waitlist = validateLeadValues('waitlist', baseValues({ feature: '' }));
  assert.equal(waitlist.feature, 'Select what you want to join the waitlist for.');
  assert.equal(
    validateLeadValues('contact', baseValues({ message: 'Hello there.' })).message,
    undefined,
  );
});
