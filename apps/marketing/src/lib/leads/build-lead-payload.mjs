import {
  LEAD_BODY_MAX_BYTES,
  LEAD_COMPANY_MAX,
  LEAD_CONSENT_TEXT_VERSION,
  LEAD_EMAIL_MAX,
  LEAD_FEATURE_MAX,
  LEAD_MESSAGE_MAX,
  LEAD_NAME_MAX,
  LEAD_PHONE_MAX,
  LEAD_PRODUCT,
  LEAD_SOURCE_PAGE_MAX,
  LEAD_SOURCE_SITE,
  LEAD_TURNSTILE_TOKEN_MAX,
  LEAD_WEBSITE_MAX,
  utf8ByteLength,
} from './lead-config.mjs';

/**
 * @typedef {'contact' | 'waitlist'} LeadFormType
 *
 * @typedef {object} LeadFormValues
 * @property {string} [name]
 * @property {string} [email]
 * @property {string} [company]
 * @property {string} [phone]
 * @property {string} [message]
 * @property {string} [feature]
 * @property {string} [website]
 * @property {boolean} [consent]
 * @property {boolean} [marketingOptIn]
 *
 * @typedef {object} BuildLeadPayloadInput
 * @property {LeadFormType} formType
 * @property {string} submissionId
 * @property {string} turnstileToken
 * @property {string} [sourcePage]
 * @property {LeadFormValues} values
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Trim; drop empty optional strings so they are omitted (schema additionalProperties: false).
 * @param {unknown} value
 * @param {number} max
 * @returns {string | undefined}
 */
function optionalTrimmed(value, max) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, max);
}

/**
 * @param {unknown} value
 * @param {number} max
 * @returns {string}
 */
function requiredTrimmed(value, max) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

/**
 * Rule 6: email is trimmed and lowercased at the submit boundary, not while typing.
 * @param {unknown} value
 * @returns {string}
 */
export function normaliseEmail(value) {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase().slice(0, LEAD_EMAIL_MAX);
}

/**
 * @param {LeadFormType} formType
 * @param {LeadFormValues} values
 * @returns {Record<string, string>}
 */
export function validateLeadValues(formType, values) {
  /** @type {Record<string, string>} */
  const errors = {};
  const name = requiredTrimmed(values.name, LEAD_NAME_MAX);
  if (!name) errors.name = 'Enter your first and last name.';

  const email = normaliseEmail(values.email);
  if (!email || !EMAIL_PATTERN.test(email)) {
    errors.email = 'Enter a valid email address.';
  }

  if (formType === 'contact') {
    const message = requiredTrimmed(values.message, LEAD_MESSAGE_MAX);
    if (!message) errors.message = 'Enter a message.';
  }

  if (formType === 'waitlist') {
    const feature = optionalTrimmed(values.feature, LEAD_FEATURE_MAX);
    if (!feature) errors.feature = 'Select what you want to join the waitlist for.';
  }

  if (values.consent !== true) {
    errors.consent = 'Please accept the privacy notice.';
  }

  return errors;
}

/**
 * Build a strict job-kit lead JSON body. Unknown keys are never included.
 * @param {BuildLeadPayloadInput} input
 * @returns {Record<string, unknown>}
 */
export function buildLeadPayload(input) {
  const { formType, submissionId, turnstileToken, sourcePage, values } = input;
  const name = requiredTrimmed(values.name, LEAD_NAME_MAX);
  const email = normaliseEmail(values.email);
  const company = optionalTrimmed(values.company, LEAD_COMPANY_MAX);
  const phone = optionalTrimmed(values.phone, LEAD_PHONE_MAX);
  const feature = optionalTrimmed(values.feature, LEAD_FEATURE_MAX);
  const website = optionalTrimmed(values.website, LEAD_WEBSITE_MAX);
  const message = optionalTrimmed(values.message, LEAD_MESSAGE_MAX);
  const page = optionalTrimmed(sourcePage, LEAD_SOURCE_PAGE_MAX);
  const token = requiredTrimmed(turnstileToken, LEAD_TURNSTILE_TOKEN_MAX);

  /** @type {Record<string, unknown>} */
  const payload = {
    sourceSite: LEAD_SOURCE_SITE,
    submissionId,
    name,
    email,
    consent: true,
    consentTextVersion: LEAD_CONSENT_TEXT_VERSION,
    marketingOptIn: values.marketingOptIn === true,
    turnstileToken: token,
    formType,
    product: LEAD_PRODUCT,
  };

  if (page) payload.sourcePage = page;
  if (company) payload.company = company;
  if (phone) payload.phone = phone;
  if (feature) payload.feature = feature;
  if (website) payload.website = website;

  if (formType === 'contact') {
    payload.message = message ?? '';
  } else if (message) {
    payload.message = message;
  }

  return payload;
}

/**
 * @param {Record<string, unknown>} payload
 * @returns {string}
 */
export function serializeLeadPayload(payload) {
  return JSON.stringify(payload);
}

/**
 * @param {string} body
 * @returns {boolean}
 */
export function isLeadBodyWithinLimit(body) {
  return utf8ByteLength(body) <= LEAD_BODY_MAX_BYTES;
}
