/**
 * Browser-side copy of the job-kit lead contract (ADR-0002 / lead-schema.ts).
 * Field names and enums must match singleton-sd/job-kit main exactly.
 */

export const LEAD_INTAKE_URL = 'https://api.singletonsd.com/v1/leads';

/** Gateway + job-kit Origin / sourceSite allowlist entry for this site. */
export const LEAD_SOURCE_SITE = 'https://plattform-kit.poc.singletonsd.com';

/** JSON `product` slug. Twenty stores PLATFORM_KIT; the HTTP body uses this value. */
export const LEAD_PRODUCT = 'platform_kit';

/** Privacy copy identifier sent as consentTextVersion (max 64). */
export const LEAD_CONSENT_TEXT_VERSION = 'platform-kit-privacy-v1';

export const LEAD_BODY_MAX_BYTES = 16 * 1024;

export const LEAD_NAME_MAX = 120;
export const LEAD_EMAIL_MAX = 254;
export const LEAD_COMPANY_MAX = 160;
export const LEAD_PHONE_MAX = 40;
export const LEAD_MESSAGE_MAX = 4000;
export const LEAD_FEATURE_MAX = 80;
export const LEAD_SOURCE_PAGE_MAX = 500;
export const LEAD_TURNSTILE_TOKEN_MAX = 4096;
export const LEAD_WEBSITE_MAX = 500;

export const WAITLIST_FEATURES = [
  { value: 'early_access', label: 'Early access' },
  { value: 'product_updates', label: 'Product updates' },
  { value: 'pricing', label: 'Pricing' },
];

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * UUID v4, generated once per form render and reused on retry.
 * @returns {string}
 */
export function createSubmissionId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * @param {string} value
 * @returns {boolean}
 */
export function isUuidV4(value) {
  return UUID_V4.test(value);
}

/**
 * @param {unknown} value
 * @returns {number}
 */
export function utf8ByteLength(value) {
  return new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value)).length;
}
