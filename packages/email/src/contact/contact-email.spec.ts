import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildContactEmailRequest,
  sendContactInquiryEmail,
  validateContactInquiry,
} from './contact-email';
import { DevelopmentEmailProvider } from '../providers/development-email.provider';
import { EmailProviderError } from '../providers/email-types';

describe('validateContactInquiry', () => {
  it('accepts a valid payload', () => {
    const result = validateContactInquiry({
      name: 'Jane Doe',
      email: 'jane@acme.com',
      subject: 'general',
      message: 'Hello, I would like a demo.',
    });
    assert.equal(result.ok, true);
  });

  it('rejects malformed email', () => {
    const result = validateContactInquiry({
      name: 'Jane',
      email: 'not-an-email',
      subject: 'general',
      message: 'Hello, I would like a demo.',
    });
    assert.equal(result.ok, false);
  });

  it('rejects header injection in email', () => {
    const result = validateContactInquiry({
      name: 'Jane',
      email: 'jane@acme.com\nBcc: leak@x.com',
      subject: 'general',
      message: 'Hello, I would like a demo.',
    });
    assert.equal(result.ok, false);
  });
});

describe('buildContactEmailRequest / sendContactInquiryEmail', () => {
  it('keeps noreply as From and customer as Reply-To', async () => {
    const provider = new DevelopmentEmailProvider({ logMetadata: false });
    const dto = {
      name: 'Jane Doe',
      email: 'jane@acme.com',
      subject: 'sales',
      message: 'Please contact me about Plattform Kit.',
    };
    const built = buildContactEmailRequest(dto, {
      inbox: 'hello@example.test',
      from: 'noreply@mail.example.test',
      fromName: 'Plattform Kit',
      correlationId: 'corr-1',
    });
    assert.equal(built.to, 'hello@example.test');
    assert.equal(built.from, 'noreply@mail.example.test');
    assert.equal(built.replyTo, 'jane@acme.com');
    assert.equal(built.subject, '[Plattform Kit] Sales / demo request');
    assert.notEqual(built.from, dto.email);

    const sent = await sendContactInquiryEmail(dto, provider, {
      EMAIL_PROVIDER: 'development',
      EMAIL_FROM_ADDRESS: 'noreply@mail.example.test',
      EMAIL_SENDING_DOMAIN: 'mail.example.test',
      EMAIL_FROM_NAME: 'Plattform Kit',
      CONTACT_INBOX_ADDRESS: 'hello@example.test',
    });
    assert.equal(sent.status, 'sent');
    assert.equal(provider.sent[0]?.replyTo, 'jane@acme.com');
    assert.equal(provider.sent[0]?.to, 'hello@example.test');
  });

  it('rejects non-aligned sender domain profile', async () => {
    const provider = new DevelopmentEmailProvider({ logMetadata: false });
    const dto = {
      name: 'Jane Doe',
      email: 'jane@acme.com',
      subject: 'sales',
      message: 'Please contact me about Plattform Kit.',
    };

    await assert.rejects(
      () =>
        sendContactInquiryEmail(dto, provider, {
          EMAIL_PROVIDER: 'development',
          EMAIL_FROM_ADDRESS: 'noreply@other-domain.test',
          EMAIL_SENDING_DOMAIN: 'mail.example.test',
          CONTACT_INBOX_ADDRESS: 'hello@example.test',
        }),
      (error: unknown) =>
        error instanceof EmailProviderError &&
        error.kind === 'configuration' &&
        error.message.includes('must align'),
    );
  });
});
