import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLeadPayload } from './build-lead-payload.mjs';
import { LEAD_INTAKE_URL } from './lead-config.mjs';
import {
  NETWORK_MESSAGE,
  RATE_LIMIT_MESSAGE,
  RETRY_MESSAGE,
  TURNSTILE_FAILED_MESSAGE,
  UNAVAILABLE_MESSAGE,
  VALIDATION_MESSAGE,
  mapLeadResponse,
  readErrorCode,
  readFieldPaths,
  readRetryAfterSeconds,
  retryAfterMessage,
  submitLead,
} from './submit-lead.mjs';

const payload = buildLeadPayload({
  formType: 'contact',
  submissionId: '550e8400-e29b-41d4-a716-446655440000',
  turnstileToken: 'turnstile-token',
  sourcePage: '/contact',
  values: {
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    message: 'Please get in touch.',
    consent: true,
  },
});

function jsonResponse(status, body, headerMap = {}) {
  return {
    status,
    headers: {
      get: (name) => {
        const key = String(name).toLowerCase();
        if (Object.hasOwn(headerMap, key)) return headerMap[key];
        if (key === 'content-type') return 'application/json';
        return null;
      },
    },
    json: async () => body,
  };
}

test('readFieldPaths uses job-kit details (paths only)', () => {
  assert.deepEqual(readFieldPaths({ error: 'payload_invalid', details: ['email', 'message'] }), [
    'email',
    'message',
  ]);
  assert.equal(readErrorCode({ error: 'function_disabled' }), 'function_disabled');
});

test('202 is success', () => {
  const result = mapLeadResponse(202, { id: payload.submissionId });
  assert.equal(result.ok, true);
  assert.equal(result.kind, 'success');
});

test('400 surfaces validation errors', () => {
  const result = mapLeadResponse(400, {
    error: 'payload_invalid',
    message: 'body does not match the lead schema',
    details: ['email'],
  });
  assert.equal(result.ok, false);
  assert.equal(result.kind, 'validation');
  assert.equal(result.message, VALIDATION_MESSAGE);
  assert.deepEqual(result.fields, ['email']);
  assert.equal(result.resetTurnstile, true);
});

test('404 function_disabled is temporarily unavailable', () => {
  const result = mapLeadResponse(404, {
    error: 'function_disabled',
    message: 'function lead-intake is disabled',
  });
  assert.equal(result.kind, 'unavailable');
  assert.equal(result.message, UNAVAILABLE_MESSAGE);
});

test('403 turnstile_failed uses a specific message', () => {
  const result = mapLeadResponse(403, { error: 'turnstile_failed' });
  assert.equal(result.kind, 'retry');
  assert.equal(result.message, TURNSTILE_FAILED_MESSAGE);
  assert.equal(result.resetTurnstile, true);
});

test('403 without turnstile_failed stays generic retry', () => {
  const result = mapLeadResponse(403, { error: 'forbidden' });
  assert.equal(result.message, RETRY_MESSAGE);
});

test('429 honours Retry-After delta-seconds', () => {
  const headers = { get: (name) => (String(name).toLowerCase() === 'retry-after' ? '12' : null) };
  const result = mapLeadResponse(429, { error: 'rate_limited' }, headers);
  assert.equal(result.kind, 'retry');
  assert.equal(result.message, 'Too many attempts. Try again in 12 seconds.');
  assert.equal(readRetryAfterSeconds(headers), 12);
  assert.equal(retryAfterMessage(null), RATE_LIMIT_MESSAGE);
});

test('5xx uses a generic retry message', () => {
  for (const status of [500, 503]) {
    const result = mapLeadResponse(status, { error: 'upstream' });
    assert.equal(result.kind, 'retry');
    assert.equal(result.message, RETRY_MESSAGE);
    assert.equal(result.resetTurnstile, true);
  }
});

test('submitLead posts JSON to the shared intake URL and reuses the body', async () => {
  /** @type {RequestInit | undefined} */
  let init;
  /** @type {string | undefined} */
  let url;
  const result = await submitLead(payload, {
    fetchImpl: async (nextUrl, nextInit) => {
      url = String(nextUrl);
      init = nextInit;
      return jsonResponse(202, { id: payload.submissionId });
    },
  });

  assert.equal(result.ok, true);
  assert.equal(url, LEAD_INTAKE_URL);
  assert.equal(init?.method, 'POST');
  assert.equal(init?.credentials, 'omit');
  assert.equal(init?.headers?.['Content-Type'], 'application/json');
  const sent = JSON.parse(String(init?.body));
  assert.equal(sent.submissionId, payload.submissionId);
  assert.equal(sent.sourceSite, 'https://plattform-kit.poc.singletonsd.com');
  assert.equal(sent.formType, 'contact');
  assert.equal(sent.product, 'platform_kit');
});

test('submitLead treats a network failure as retry', async () => {
  const result = await submitLead(payload, {
    fetchImpl: async () => {
      throw new TypeError('Failed to fetch');
    },
  });
  assert.equal(result.kind, 'retry');
  assert.equal(result.message, NETWORK_MESSAGE);
  assert.equal(result.resetTurnstile, true);
});

test('submitLead maps a mocked 404 function_disabled body', async () => {
  const result = await submitLead(payload, {
    fetchImpl: async () =>
      jsonResponse(404, {
        error: 'function_disabled',
        message: 'function lead-intake is disabled',
      }),
  });
  assert.equal(result.kind, 'unavailable');
  assert.equal(result.message, UNAVAILABLE_MESSAGE);
});

test('submitLead maps 429 Retry-After from response headers', async () => {
  const result = await submitLead(payload, {
    fetchImpl: async () => jsonResponse(429, { error: 'rate_limited' }, { 'retry-after': '5' }),
  });
  assert.equal(result.kind, 'retry');
  assert.equal(result.message, 'Too many attempts. Try again in 5 seconds.');
  assert.equal(result.resetTurnstile, true);
});

test('submitLead times out as retry', async () => {
  const result = await submitLead(payload, {
    timeoutMs: 20,
    fetchImpl: async (_url, init) => {
      await new Promise((_, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
        });
      });
    },
  });
  assert.equal(result.kind, 'retry');
  assert.equal(result.message, NETWORK_MESSAGE);
  assert.equal(result.resetTurnstile, true);
});
