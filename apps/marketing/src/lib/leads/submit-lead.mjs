import { LEAD_BODY_MAX_BYTES, LEAD_INTAKE_URL, utf8ByteLength } from './lead-config.mjs';
import { isLeadBodyWithinLimit } from './build-lead-payload.mjs';

/**
 * @typedef {'success' | 'validation' | 'unavailable' | 'retry'} LeadSubmitKind
 *
 * @typedef {object} LeadSubmitResult
 * @property {boolean} ok
 * @property {LeadSubmitKind} kind
 * @property {string} message
 * @property {string[]} [fields]
 * @property {boolean} [resetTurnstile]
 */

export const VALIDATION_MESSAGE = 'Please fix the highlighted fields and try again.';
export const UNAVAILABLE_MESSAGE =
  'Lead intake is temporarily unavailable. Please try again later.';
export const RETRY_MESSAGE = 'Something went wrong. Please try again.';
export const NETWORK_MESSAGE =
  'We could not reach the server. Check your connection and try again.';
export const TOKEN_REQUIRED_MESSAGE = 'Complete the security check.';
export const BODY_TOO_LARGE_MESSAGE = 'Your message is too long. Shorten it and try again.';
export const LEAD_SUBMIT_TIMEOUT_MS = 15_000;

/**
 * @param {unknown} value
 * @returns {Record<string, unknown> | null}
 */
function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? /** @type {Record<string, unknown>} */ (value)
    : null;
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
export function readFieldPaths(value) {
  const record = asRecord(value);
  if (!record) return [];
  if (Array.isArray(record.details)) {
    return record.details.filter((item) => typeof item === 'string' && item.length > 0);
  }
  return [];
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function readErrorCode(value) {
  const record = asRecord(value);
  if (!record) return '';
  if (typeof record.error === 'string') return record.error;
  if (typeof record.code === 'string') return record.code;
  return '';
}

/**
 * Map job-kit / APISIX status codes to brochure UX.
 * 400 → field paths; 404 function_disabled → unavailable; 403/429/5xx → retry.
 * @param {number} status
 * @param {unknown} body
 * @returns {LeadSubmitResult}
 */
export function mapLeadResponse(status, body) {
  const code = readErrorCode(body);
  const fields = readFieldPaths(body);

  if (status === 202) {
    return { ok: true, kind: 'success', message: '' };
  }

  if (status === 404 || code === 'function_disabled') {
    return {
      ok: false,
      kind: 'unavailable',
      message: UNAVAILABLE_MESSAGE,
      resetTurnstile: true,
    };
  }

  if (status === 400) {
    return {
      ok: false,
      kind: 'validation',
      message: VALIDATION_MESSAGE,
      fields,
      resetTurnstile: true,
    };
  }

  if (status === 403 || status === 429 || status >= 500) {
    return {
      ok: false,
      kind: 'retry',
      message: RETRY_MESSAGE,
      resetTurnstile: true,
    };
  }

  if (status === 413 || utf8ByteLength(JSON.stringify(body ?? '')) > LEAD_BODY_MAX_BYTES) {
    return {
      ok: false,
      kind: 'validation',
      message: BODY_TOO_LARGE_MESSAGE,
      fields: ['message'],
      resetTurnstile: true,
    };
  }

  return {
    ok: false,
    kind: 'retry',
    message: RETRY_MESSAGE,
    resetTurnstile: true,
  };
}

/**
 * POST JSON to the shared lead-intake gateway. No server code in this repo.
 * @param {Record<string, unknown>} payload
 * @param {object} [options]
 * @param {typeof fetch} [options.fetchImpl]
 * @param {string} [options.url]
 * @param {number} [options.timeoutMs]
 * @returns {Promise<LeadSubmitResult>}
 */
export async function submitLead(payload, options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const url = options.url ?? LEAD_INTAKE_URL;
  const timeoutMs = options.timeoutMs ?? LEAD_SUBMIT_TIMEOUT_MS;
  const body = JSON.stringify(payload);

  if (!isLeadBodyWithinLimit(body)) {
    return {
      ok: false,
      kind: 'validation',
      message: BODY_TOO_LARGE_MESSAGE,
      fields: ['message'],
      resetTurnstile: false,
    };
  }

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller?.abort();
      reject(Object.assign(new Error('lead intake timed out'), { name: 'AbortError' }));
    }, timeoutMs);
  });
  timeoutPromise.catch(() => undefined);

  const fetchPromise = (async () => {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      credentials: 'omit',
      signal: controller?.signal,
      body,
    });
    let parsed = null;
    try {
      parsed = await response.json();
    } catch {
      parsed = null;
    }
    return mapLeadResponse(response.status, parsed);
  })();
  fetchPromise.catch(() => undefined);

  try {
    return await Promise.race([fetchPromise, timeoutPromise]);
  } catch {
    return {
      ok: false,
      kind: 'retry',
      message: NETWORK_MESSAGE,
      resetTurnstile: true,
    };
  } finally {
    clearTimeout(timer);
  }
}
