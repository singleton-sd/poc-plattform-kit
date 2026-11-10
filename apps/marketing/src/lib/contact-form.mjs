/**
 * Browser + Node helper for the public marketing Contact form.
 *
 * PostKit `POST /contact` accepts only `{ name, email, subject, message }`.
 * Optional company / phone and the Platform Kit source tag are composed into
 * `message` until PostKit grows first-class fields for them. There is no
 * visitor-facing "source" / "how did you hear about us" question.
 *
 * Form UX (form-ux skill):
 * - Rule 4 (pre-fill): not applicable as profile pre-fill — this is an
 *   anonymous public form. Inquiry type may be defaulted from a CTA query
 *   (`?subject=sales` or `?subject=demo`), which is a navigation hint.
 * - Rule 5 (password): not applicable — no password field.
 * - Rule 6 (forgiving formatting): email is trimmed + lowercased at the
 *   submit/validate boundary; phone keeps the typed value (spaces, dashes,
 *   parentheses allowed) and is not rewritten to a guessed country code.
 */

export const CONTACT_SUBJECTS = /** @type {const} */ ([
  'general',
  'sales',
  'support',
  'partnership',
]);

/** @typedef {(typeof CONTACT_SUBJECTS)[number]} ContactSubject */

export const CONTACT_SUBJECT_OPTIONS = [
  { value: 'general', label: 'General inquiry' },
  { value: 'sales', label: 'Sales / demo request' },
  { value: 'support', label: 'Technical support' },
  { value: 'partnership', label: 'Partnership' },
];

/** Automatic source tag — never collected from the visitor. */
export const CONTACT_FORM_SOURCE = 'Platform Kit contact form';

/** Mirrors PostKit `packages/post-kit-email` contact validation ceilings. */
export const CONTACT_LIMITS = {
  nameMax: 120,
  emailMax: 254,
  companyMax: 120,
  phoneMax: 40,
  phoneMinDigits: 6,
  phoneMaxDigits: 15,
  messageMin: 10,
  messageMax: 5000,
};

const EMAIL_RE = /^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/;
const PHONE_ALLOWED_RE = /^[+0-9()\s./-]+$/;

/**
 * @param {string} value
 * @param {boolean} allowMessageWhitespace
 */
export function hasForbiddenControls(value, allowMessageWhitespace) {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code === 0x7f) return true;
    if (code >= 0x20) continue;
    if (allowMessageWhitespace && (code === 0x09 || code === 0x0a)) continue;
    return true;
  }
  return false;
}

/** @param {string | null | undefined} raw */
export function resolveInquirySubject(raw) {
  if (raw == null) return '';
  const value = raw.trim().toLowerCase();
  if (!value) return '';
  if (value === 'demo') return 'sales';
  if (CONTACT_SUBJECTS.includes(/** @type {ContactSubject} */ (value))) {
    return /** @type {ContactSubject} */ (value);
  }
  return '';
}

/**
 * PostKit requires `subject`. Empty / unknown inquiry types become `general`.
 * @param {string | null | undefined} raw
 * @returns {ContactSubject}
 */
export function subjectForPostKit(raw) {
  const resolved = resolveInquirySubject(raw);
  return resolved === '' ? 'general' : resolved;
}

/**
 * @param {{ company?: string, phone?: string }} input
 */
export function buildContactMessagePrefix(input = {}) {
  const company = (input.company ?? '').trim();
  const phone = (input.phone ?? '').trim();
  const lines = [`Submitted via: ${CONTACT_FORM_SOURCE}`];
  if (company) lines.push(`Company: ${company}`);
  if (phone) lines.push(`Phone: ${phone}`);
  return `${lines.join('\n')}\n\n`;
}

/**
 * Conservative user-message ceiling so max company + phone + source tag
 * still fit in PostKit's 5000-character `message` field.
 */
export const CONTACT_MESSAGE_FIELD_MAX =
  CONTACT_LIMITS.messageMax -
  buildContactMessagePrefix({
    company: 'x'.repeat(CONTACT_LIMITS.companyMax),
    phone: 'x'.repeat(CONTACT_LIMITS.phoneMax),
  }).length;

/**
 * @param {{ message: string, company?: string, phone?: string }} input
 */
export function buildContactMessage(input) {
  return `${buildContactMessagePrefix(input)}${input.message}`;
}

/** @param {string} raw */
export function phoneDigitCount(raw) {
  return (raw.match(/\d/g) ?? []).length;
}

/**
 * Optional phone: empty is valid. Non-empty values may include spaces,
 * dashes, parentheses, dots, and a leading +. Country code is not guessed.
 * @param {string} raw
 */
export function isPlausiblePhone(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return true;
  if (trimmed.length > CONTACT_LIMITS.phoneMax) return false;
  if (!PHONE_ALLOWED_RE.test(trimmed)) return false;
  const digits = phoneDigitCount(trimmed);
  return digits >= CONTACT_LIMITS.phoneMinDigits && digits <= CONTACT_LIMITS.phoneMaxDigits;
}

/**
 * @typedef {{
 *   name: string,
 *   email: string,
 *   company: string,
 *   phone: string,
 *   subject: string,
 *   message: string,
 * }} ContactFormFields
 */

/**
 * @typedef {Partial<Record<keyof ContactFormFields, string>>} ContactFormErrors
 */

/**
 * @param {ContactFormFields} fields
 * @returns {ContactFormErrors}
 */
export function validateContactForm(fields) {
  const errors = /** @type {ContactFormErrors} */ ({});
  const name = fields.name.trim();
  const email = fields.email.trim().toLowerCase();
  const company = fields.company.trim();
  const phone = fields.phone.trim();
  const subject = fields.subject.trim();
  const message = fields.message.trim();

  if (!name) {
    errors.name = 'Enter your first and last name.';
  } else if (name.length > CONTACT_LIMITS.nameMax || hasForbiddenControls(name, false)) {
    errors.name = `Enter a name (max ${CONTACT_LIMITS.nameMax} characters).`;
  }

  if (
    !EMAIL_RE.test(email) ||
    email.length > CONTACT_LIMITS.emailMax ||
    hasForbiddenControls(email, false)
  ) {
    errors.email = 'Enter a valid email address.';
  }

  if (company) {
    if (company.length > CONTACT_LIMITS.companyMax || hasForbiddenControls(company, false)) {
      errors.company = `Enter a company name (max ${CONTACT_LIMITS.companyMax} characters).`;
    }
  }

  if (phone && !isPlausiblePhone(phone)) {
    errors.phone = 'Enter a phone number with a country code, or leave this blank.';
  }

  if (subject && resolveInquirySubject(subject) === '') {
    errors.subject = 'Select an inquiry type, or leave this blank.';
  }

  if (message.length < CONTACT_LIMITS.messageMin) {
    errors.message = `Enter a message of at least ${CONTACT_LIMITS.messageMin} characters.`;
  } else if (message.length > CONTACT_MESSAGE_FIELD_MAX || hasForbiddenControls(message, true)) {
    errors.message = `Enter a message of ${CONTACT_LIMITS.messageMin}–${CONTACT_MESSAGE_FIELD_MAX} characters.`;
  }

  return errors;
}

/** @param {ContactFormErrors} errors */
export function isContactFormValid(errors) {
  return Object.keys(errors).length === 0;
}

/**
 * @typedef {{
 *   name: string,
 *   email: string,
 *   subject: ContactSubject,
 *   message: string,
 * }} PostKitContactPayload
 */

/**
 * @param {ContactFormFields} fields
 * @returns {{ ok: true, value: PostKitContactPayload } | { ok: false, errors: ContactFormErrors }}
 */
export function buildPostKitContactPayload(fields) {
  const errors = validateContactForm(fields);
  if (!isContactFormValid(errors)) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      name: fields.name.trim(),
      email: fields.email.trim().toLowerCase(),
      subject: subjectForPostKit(fields.subject),
      message: buildContactMessage({
        message: fields.message.trim(),
        company: fields.company.trim(),
        phone: fields.phone.trim(),
      }),
    },
  };
}
