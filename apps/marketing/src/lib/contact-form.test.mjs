import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  CONTACT_FORM_SOURCE,
  CONTACT_LIMITS,
  CONTACT_MESSAGE_FIELD_MAX,
  buildContactMessage,
  buildPostKitContactPayload,
  isContactFormValid,
  resolveInquirySubject,
  subjectForPostKit,
  validateContactForm,
} from './contact-form.mjs';

const marketingSrc = join(dirname(fileURLToPath(import.meta.url)), '..');

/** @param {Partial<import('./contact-form.mjs').ContactFormFields>} overrides */
function fields(overrides = {}) {
  return {
    name: 'Jane Doe',
    email: 'jane@example.com',
    company: '',
    phone: '',
    subject: '',
    message: 'Please tell me more about Platform Kit.',
    ...overrides,
  };
}

test('keeps name and email required', () => {
  const missing = validateContactForm(fields({ name: '  ', email: '' }));
  assert.equal(missing.name, 'Enter your first and last name.');
  assert.equal(missing.email, 'Enter a valid email address.');
});

test('keeps the PostKit 10-character message minimum', () => {
  const errors = validateContactForm(fields({ message: 'too short' }));
  assert.equal(errors.message, 'Enter a message of at least 10 characters.');
  assert.equal(isContactFormValid(errors), false);
});

test('treats company, phone, and inquiry type as optional', () => {
  const result = buildPostKitContactPayload(fields());
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.subject, 'general');
  assert.match(result.value.message, /Please tell me more about Platform Kit/);
});

test('does not ask for or send a visitor source field', () => {
  const result = buildPostKitContactPayload(
    fields({
      company: 'Acme',
      phone: '+61 400 000 000',
    }),
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(Object.keys(result.value).sort(), ['email', 'message', 'name', 'subject']);
  assert.equal('source' in result.value, false);
  assert.equal('company' in result.value, false);
  assert.equal('phone' in result.value, false);
});

test('automatically tags the composed message as the Platform Kit contact form', () => {
  const result = buildPostKitContactPayload(fields());
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.match(result.value.message, new RegExp(`^Submitted via: ${CONTACT_FORM_SOURCE}\\n\\n`));
});

test('appends optional company and phone to the message body', () => {
  const result = buildPostKitContactPayload(
    fields({
      company: 'Singleton SD',
      phone: '+61 (0) 400-000-000',
    }),
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(
    result.value.message,
    [
      `Submitted via: ${CONTACT_FORM_SOURCE}`,
      'Company: Singleton SD',
      'Phone: +61 (0) 400-000-000',
      '',
      'Please tell me more about Platform Kit.',
    ].join('\n'),
  );
});

test('accepts phone formatting variants without guessing a country code', () => {
  const ok = validateContactForm(fields({ phone: '(04) 1234 5678' }));
  assert.equal(ok.phone, undefined);
  const bad = validateContactForm(fields({ phone: 'call me maybe' }));
  assert.equal(bad.phone, 'Enter a phone number with a country code, or leave this blank.');
});

test('lowercases email at the submit boundary', () => {
  const result = buildPostKitContactPayload(fields({ email: '  Jane@Example.COM  ' }));
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.email, 'jane@example.com');
});

test('maps demo / sales CTA aliases to the PostKit sales subject', () => {
  assert.equal(resolveInquirySubject('demo'), 'sales');
  assert.equal(resolveInquirySubject('SALES'), 'sales');
  assert.equal(subjectForPostKit(''), 'general');
  assert.equal(subjectForPostKit('partnership'), 'partnership');
  assert.equal(subjectForPostKit('unknown'), 'general');
});

test('keeps an explicit inquiry type when the visitor selects one', () => {
  const result = buildPostKitContactPayload(fields({ subject: 'support' }));
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.subject, 'support');
});

test('composed max-length fields stay within the PostKit 5000-character cap', () => {
  const result = buildPostKitContactPayload(
    fields({
      company: 'C'.repeat(CONTACT_LIMITS.companyMax),
      phone: '+123456789012345',
      message: 'M'.repeat(CONTACT_MESSAGE_FIELD_MAX),
    }),
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.ok(result.value.message.length <= CONTACT_LIMITS.messageMax);
  assert.match(result.value.message, new RegExp(`Submitted via: ${CONTACT_FORM_SOURCE}`));
});

test('rejects a user message that would overflow after company and phone are appended', () => {
  const errors = validateContactForm(
    fields({ message: 'M'.repeat(CONTACT_MESSAGE_FIELD_MAX + 1) }),
  );
  assert.match(errors.message ?? '', /characters/);
});

test('buildContactMessage omits blank optional lines', () => {
  assert.equal(
    buildContactMessage({ message: 'Hello there, I have a question.' }),
    `Submitted via: ${CONTACT_FORM_SOURCE}\n\nHello there, I have a question.`,
  );
});

test('the contact page does not collect source or wire a CRM', () => {
  const form = readFileSync(join(marketingSrc, 'components/marketing/ContactForm.astro'), 'utf8');
  assert.match(form, /name="company"/);
  assert.match(form, /name="phone"/);
  assert.match(form, /name="subject"/);
  assert.doesNotMatch(form, /name="source"/);
  assert.doesNotMatch(form, /how did you hear/i);
  assert.doesNotMatch(form, /twenty/i);
  assert.doesNotMatch(form, /crm/i);
});

test('the message textarea does not ship a literal slot placeholder', () => {
  const area = readFileSync(join(marketingSrc, 'components/ui/TextArea.astro'), 'utf8');
  assert.doesNotMatch(area, /<slot\s*\/>/);
});
