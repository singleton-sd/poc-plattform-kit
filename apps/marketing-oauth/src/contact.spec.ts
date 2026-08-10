import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildContactEmailRequest,
  contactCorsHeaders,
  submitContactInquiry,
  validateContactInquiry,
} from './contact';
import { ForwardEmailClient } from './forward-email';

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
});

describe('submitContactInquiry', () => {
  it('sends via Forward Email when configured', async () => {
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

  it('builds reply-to and subject labels', () => {
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
    assert.match(req.subject ?? '', /Sales \/ demo request/);
  });
});

describe('contactCorsHeaders', () => {
  it('reflects allowed marketing origins', () => {
    process.env.ORIGINS =
      'plattform-kit.poc.singletonsd.com,purple-field-05048bf00*.azurestaticapps.net,localhost:4321';
    const headers = contactCorsHeaders('https://plattform-kit.poc.singletonsd.com');
    assert.equal(
      headers['Access-Control-Allow-Origin'],
      'https://plattform-kit.poc.singletonsd.com',
    );
  });

  it('omits Allow-Origin for unknown hosts', () => {
    process.env.ORIGINS = 'plattform-kit.poc.singletonsd.com';
    const headers = contactCorsHeaders('https://evil.example');
    assert.equal(headers['Access-Control-Allow-Origin'], undefined);
  });
});
