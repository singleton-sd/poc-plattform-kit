import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DevelopmentEmailProvider } from '@poc-plattform-kit/email';
import {
  buildContactEmailRequest,
  contactCorsHeaders,
  resolveContactEmailProvider,
  resolveTrustedContactHost,
  submitContactInquiry,
  validateContactInquiry,
} from './contact';
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
  });

  it('rejects CR/LF/NUL in name (header-injection surface)', () => {
    const withCrLf = validateContactInquiry({
      name: 'Alice\r\nBcc: victim@evil.com',
      email: 'jane@acme.com',
      subject: 'sales',
      message: 'I would like a demo of Platform Kit.',
    });
    assert.equal(withCrLf.ok, false);
  });

  it('allows newlines in message but rejects CR', () => {
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

describe('marketing-oauth contact send', () => {
  it('forces development provider for SWA preview origins', () => {
    const provider = resolveContactEmailProvider('https://nice-wave-123.azurestaticapps.net', {
      EMAIL_PROVIDER: 'forward-email',
      FORWARD_EMAIL_TOKEN: 'secret',
      EMAIL_ALLOW_PRODUCTION_SEND: 'true',
    });
    assert.equal(provider.name, 'development');
  });

  it('sends via injected provider with noreply From and customer Reply-To', async () => {
    const email = new DevelopmentEmailProvider({ logMetadata: false });
    const result = await submitContactInquiry(
      {
        name: 'Jane Doe',
        email: 'jane@acme.com',
        subject: 'sales',
        message: 'Please schedule a demo for us.',
      },
      {
        email,
        env: {
          EMAIL_FROM_ADDRESS: 'noreply@mail.plattform-kit.poc.singletonsd.com',
          EMAIL_FROM_NAME: 'Plattform Kit',
          CONTACT_INBOX_ADDRESS: 'hello@singletonsd.com',
        },
      },
    );
    assert.equal(result.status, 'sent');
    assert.equal(email.sent[0]?.to, 'hello@singletonsd.com');
    assert.equal(email.sent[0]?.replyTo, 'jane@acme.com');
    assert.match(String(email.sent[0]?.from), /noreply@mail\.plattform-kit\.poc\.singletonsd\.com/);
    assert.equal(email.sent[0]?.subject, '[Plattform Kit] Sales / demo request');
  });

  it('applies host-based sender profile override when configured', async () => {
    const email = new DevelopmentEmailProvider({ logMetadata: false });
    const result = await submitContactInquiry(
      {
        name: 'Jane Doe',
        email: 'jane@acme.com',
        subject: 'support',
        message: 'Please help with setup details for this PoC.',
      },
      {
        requestOrigin: 'https://inkads.poc.singletonsd.com',
        email,
        env: {
          ORIGINS: 'inkads.poc.singletonsd.com',
          EMAIL_FROM_ADDRESS: 'noreply@mail.plattform-kit.poc.singletonsd.com',
          EMAIL_FROM_NAME: 'Plattform Kit',
          CONTACT_INBOX_ADDRESS: 'hello@singletonsd.com',
          CONTACT_EMAIL_PROFILES_BY_HOST: JSON.stringify({
            'inkads.poc.singletonsd.com': {
              fromAddress: 'noreply@mail.inkads.poc.singletonsd.com',
              fromName: 'InkAds',
              contactInboxAddress: 'inkads-support@singletonsd.com',
            },
          }),
        },
      },
    );
    assert.equal(result.status, 'sent');
    assert.equal(email.sent[0]?.to, 'inkads-support@singletonsd.com');
    assert.match(String(email.sent[0]?.from), /noreply@mail\.inkads\.poc\.singletonsd\.com/);
  });

  it('ignores host profile overrides for untrusted Origin hosts', async () => {
    const email = new DevelopmentEmailProvider({ logMetadata: false });
    const result = await submitContactInquiry(
      {
        name: 'Jane Doe',
        email: 'jane@acme.com',
        subject: 'support',
        message: 'Please help with setup details for this PoC.',
      },
      {
        requestOrigin: 'https://evil.example.com',
        email,
        env: {
          ORIGINS: 'inkads.poc.singletonsd.com',
          EMAIL_FROM_ADDRESS: 'noreply@mail.plattform-kit.poc.singletonsd.com',
          CONTACT_INBOX_ADDRESS: 'hello@singletonsd.com',
          CONTACT_EMAIL_PROFILES_BY_HOST: JSON.stringify({
            'evil.example.com': {
              fromAddress: 'noreply@mail.inkads.poc.singletonsd.com',
              contactInboxAddress: 'inkads-support@singletonsd.com',
            },
          }),
        },
      },
    );
    assert.equal(result.status, 'sent');
    assert.equal(email.sent[0]?.to, 'hello@singletonsd.com');
  });

  it('builds reply-to and fixed subject labels (no free-text name)', () => {
    const req = buildContactEmailRequest(
      {
        name: 'Jane Doe',
        email: 'jane@acme.com',
        subject: 'sales',
        message: 'I would like a demo of Platform Kit.',
      },
      {
        inbox: 'hello@singletonsd.com',
        from: 'noreply@example.com',
        correlationId: 'corr-1',
      },
    );
    assert.equal(req.replyTo, 'jane@acme.com');
    assert.equal(req.subject, '[Plattform Kit] Sales / demo request');
    assert.match(req.text ?? '', /Name: Jane Doe/);
  });
});

describe('resolveTrustedContactHost', () => {
  it('returns the host when Origin matches ORIGINS allowlist', () => {
    assert.equal(
      resolveTrustedContactHost('https://inkads.poc.singletonsd.com', {
        ORIGINS: 'inkads.poc.singletonsd.com',
      }),
      'inkads.poc.singletonsd.com',
    );
  });

  it('returns null for hosts outside the allowlist', () => {
    assert.equal(
      resolveTrustedContactHost('https://evil.example.com', {
        ORIGINS: 'inkads.poc.singletonsd.com',
      }),
      null,
    );
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
