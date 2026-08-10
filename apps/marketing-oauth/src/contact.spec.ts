import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DevelopmentEmailProvider } from '@poc-plattform-kit/pillar-notifications';
import {
  resolveContactEmailProvider,
  submitContactInquiry,
  validateContactInquiry,
} from './contact';

describe('marketing-oauth contact', () => {
  it('validates payloads', () => {
    const ok = validateContactInquiry({
      name: 'Jane',
      email: 'jane@acme.com',
      subject: 'general',
      message: 'Hello there, I need help.',
    });
    assert.equal(ok.ok, true);
  });

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
          EMAIL_FROM_ADDRESS: 'noreply@plattform-kit.poc.singletonsd.com',
          EMAIL_FROM_NAME: 'Plattform Kit',
          CONTACT_INBOX_ADDRESS: 'hello@singletonsd.com',
        },
      },
    );
    assert.equal(result.status, 'sent');
    assert.equal(email.sent[0]?.to, 'hello@singletonsd.com');
    assert.equal(email.sent[0]?.replyTo, 'jane@acme.com');
    assert.match(String(email.sent[0]?.from), /noreply@plattform-kit\.poc\.singletonsd\.com/);
  });
});
