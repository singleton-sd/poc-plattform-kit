import { randomUUID } from 'node:crypto';
import { loadEmailRuntimeConfig } from '../providers/create-email-provider';
import type { EmailProvider, EmailSendRequest, EmailSendResult } from '../providers/email-types';
import { EmailProviderError, sanitizeHeaderValue } from '../providers/email-types';

export const CONTACT_SUBJECTS = ['general', 'sales', 'support', 'partnership'] as const;
export type ContactSubject = (typeof CONTACT_SUBJECTS)[number];

export interface ContactInquiryInput {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export type ContactValidationResult =
  { ok: true; value: ContactInquiryInput } | { ok: false; status: 400; error: string };

const SUBJECT_LABELS: Record<ContactSubject, string> = {
  general: 'General inquiry',
  sales: 'Sales / demo request',
  support: 'Technical support',
  partnership: 'Partnership',
};

/** Practical email shape; rejects CR/LF and obvious header injection. */
const EMAIL_RE = /^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/;

export function validateContactInquiry(body: unknown): ContactValidationResult {
  if (!body || typeof body !== 'object') {
    return { ok: false, status: 400, error: 'Expected a JSON object body.' };
  }
  const record = body as Record<string, unknown>;
  const name = typeof record.name === 'string' ? sanitizeHeaderValue(record.name) : '';
  const email = typeof record.email === 'string' ? sanitizeHeaderValue(record.email) : '';
  const subject = typeof record.subject === 'string' ? sanitizeHeaderValue(record.subject) : '';
  const message = typeof record.message === 'string' ? record.message.trim() : '';

  if (!name || name.length > 120) {
    return { ok: false, status: 400, error: 'Enter a name (max 120 characters).' };
  }
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return { ok: false, status: 400, error: 'Enter a valid email address.' };
  }
  if (!(CONTACT_SUBJECTS as readonly string[]).includes(subject)) {
    return { ok: false, status: 400, error: 'Select a valid subject.' };
  }
  if (message.length < 10 || message.length > 5000) {
    return { ok: false, status: 400, error: 'Enter a message of 10–5000 characters.' };
  }
  if (/[\r\n]/.test(record.name as string) || /[\r\n]/.test(record.email as string)) {
    return { ok: false, status: 400, error: 'Invalid characters in name or email.' };
  }

  return {
    ok: true,
    value: { name, email, subject: subject as ContactSubject, message },
  };
}

export function buildContactEmailRequest(
  dto: ContactInquiryInput,
  options: {
    inbox: string;
    from: string;
    fromName?: string;
    correlationId: string;
  },
): EmailSendRequest {
  const subjectLabel = SUBJECT_LABELS[dto.subject as ContactSubject];
  const text = [
    `New marketing contact inquiry (${subjectLabel})`,
    '',
    `Name: ${dto.name}`,
    `Email: ${dto.email}`,
    `Subject: ${subjectLabel}`,
    '',
    dto.message,
  ].join('\n');

  return {
    to: options.inbox,
    from: options.from,
    fromName: options.fromName,
    replyTo: dto.email,
    subject: `[Plattform Kit] ${subjectLabel} — ${dto.name}`,
    text,
    correlationId: options.correlationId,
  };
}

export async function sendContactInquiryEmail(
  dto: ContactInquiryInput,
  email: EmailProvider,
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ id: string; status: 'sent'; result: EmailSendResult }> {
  const config = loadEmailRuntimeConfig(env);
  if (!config.contactInboxAddress || !config.fromAddress) {
    throw new EmailProviderError({
      message: 'Contact email addresses are not configured',
      kind: 'configuration',
      provider: email.name,
    });
  }
  if (!email.isConfigured()) {
    throw new EmailProviderError({
      message:
        email.name === 'forward-email'
          ? 'FORWARD_EMAIL_TOKEN is not configured'
          : 'Email provider is not configured',
      kind: 'configuration',
      provider: email.name,
    });
  }

  const id = randomUUID();
  const request = buildContactEmailRequest(dto, {
    inbox: config.contactInboxAddress,
    from: config.fromAddress,
    fromName: config.fromName,
    correlationId: id,
  });
  const result = await email.send(request);
  return { id, status: 'sent', result };
}
