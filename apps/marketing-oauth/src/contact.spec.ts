import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildContactEmailRequest,
  contactCorsHeaders,
  submitContactInquiry,
  validateContactInquiry,
} from './contact';
import { ForwardEmailClient } from './forward-email';
import { SlidingWindowRateLimiter, clientIpFromHeaders } from './contact-rate-limit';

function withEnv(keys: string[], run: () => void | Promise<void>): Promise<void> {
  const prior = new Map<string, string | undefined>();
  for (const key of keys) {
    prior.set(key, process.env[key]);
  }
  return Promise.resolve()
    .then(run)
    .finally(() => {
      for (const [key, value] of prior) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    });
}

describe('validateContactInquiry', () => {
  it('accepts a valid payload', () => {
    const result = validateContactInquiry({
      name: 'Jane Doe',
      email: 'jane@acme.com',
      subject: 'sales',
      message: 'I would like a demo of Platform Kit.',
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.subject, 'sales');
    }
  });

  it('rejects bad email and subject', () => {
    const result = validateContactInquiry({
      name: 'Jane',
      email: 'nope',
      subject: 'billing',
      message: 'short',
    });
    assert.equal(result.ok, false);
  });

  it('rejects CR/LF/NUL in name (header-injection surface)', () => {
    const withCrLf = validateContactInquiry({
      name: 'Alice\r\nBcc: victim@evil.com',
      email: 'jane@acme.com',
      subject: 'sales',
      message: 'I would like a demo of Platform Kit.',
    });
    assert.equal(withCrLf.ok, false);

    const withNul = validateContactInquiry({
      name: 'Alice\0Bob',
      email: 'jane@acme.com',
      subject: 'sales',
      message: 'I would like a demo of Platform Kit.',
    });
    assert.equal(withNul.ok, false);
  });

  it('allows newlines in message but rejects CR/NUL', () => {
    const withNewline = validateContactInquiry({
      name: 'Jane Doe',
      email: 'jane@acme.com',
      subject: 'sales',
      message: 'Line one.\nLine two is still fine here.',
    });
    assert.equal(withNewline.ok, true);

    const withCr = validateContactInquiry({
      name: 'Jane Doe',
      email: 'jane@acme.com',
      subject: 'sales',
      message: 'Line one.\rLine two should fail validation.',
    });
    assert.equal(withCr.ok, false);
  });
});

describe('submitContactInquiry', () => {
  it('sends via Forward Email when configured', async () => {
    await withEnv(['CONTACT_INBOX_EMAIL', 'CONTACT_FROM_EMAIL'], async () => {
      process.env.CONTACT_INBOX_EMAIL = 'hello@singletonsd.com';
      process.env.CONTACT_FROM_EMAIL = 'noreply@plattform-kit.poc.singletonsd.com';
      const sendCalls: unknown[] = [];
      const email = new ForwardEmailClient({
        apiKey: 'test-token',
        fetchImpl: async () => {
          sendCalls.push(true);
          return new Response(JSON.stringify({ id: 'fe-1' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        },
      });

      const result = await submitContactInquiry(
        {
          name: 'Jane Doe',
          email: 'jane@acme.com',
          subject: 'support',
          message: 'Need help with SSO setup please.',
        },
        email,
      );

      assert.equal(result.status, 'sent');
      assert.match(result.id, /^[0-9a-f-]{36}$/i);
      assert.equal(sendCalls.length, 1);
    });
  });

  it('builds reply-to and fixed subject labels (no free-text name)', () => {
    const req = buildContactEmailRequest(
      {
        name: 'Jane Doe',
        email: 'jane@acme.com',
        subject: 'sales',
        message: 'I would like a demo of Platform Kit.',
      },
      'hello@singletonsd.com',
      'noreply@example.com',
      'corr-1',
    );
    assert.equal(req.replyTo, 'jane@acme.com');
    assert.equal(req.subject, '[Platform Kit] Sales / demo request');
    assert.match(req.text ?? '', /Name: Jane Doe/);
  });
});

describe('contactCorsHeaders', () => {
  it('reflects allowed marketing origins', async () => {
    await withEnv(['ORIGINS'], () => {
      process.env.ORIGINS =
        'plattform-kit.poc.singletonsd.com,purple-field-05048bf00*.azurestaticapps.net,localhost:4321';
      const headers = contactCorsHeaders('https://plattform-kit.poc.singletonsd.com');
      assert.equal(
        headers['Access-Control-Allow-Origin'],
        'https://plattform-kit.poc.singletonsd.com',
      );
    });
  });

  it('omits Allow-Origin for unknown hosts', async () => {
    await withEnv(['ORIGINS'], () => {
      process.env.ORIGINS = 'plattform-kit.poc.singletonsd.com';
      const headers = contactCorsHeaders('https://evil.example');
      assert.equal(headers['Access-Control-Allow-Origin'], undefined);
    });
  });
});

describe('SlidingWindowRateLimiter', () => {
  it('allows up to max then returns 429-style deny', () => {
    const limiter = new SlidingWindowRateLimiter(2, 60_000);
    const t0 = 1_000_000;
    assert.equal(limiter.tryConsume('1.1.1.1', t0).allowed, true);
    assert.equal(limiter.tryConsume('1.1.1.1', t0 + 1).allowed, true);
    const denied = limiter.tryConsume('1.1.1.1', t0 + 2);
    assert.equal(denied.allowed, false);
    assert.ok(denied.retryAfterSec >= 1);
  });

  it('isolates keys and reads first X-Forwarded-For hop', () => {
    const limiter = new SlidingWindowRateLimiter(1, 60_000);
    assert.equal(limiter.tryConsume('a', 1).allowed, true);
    assert.equal(limiter.tryConsume('b', 1).allowed, true);

    const headers = new Map([['x-forwarded-for', '203.0.113.9, 10.0.0.1']]);
    assert.equal(clientIpFromHeaders({ get: (n) => headers.get(n) ?? null }), '203.0.113.9');
  });
});
