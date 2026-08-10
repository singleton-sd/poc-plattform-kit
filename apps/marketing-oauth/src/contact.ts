import { randomUUID } from 'node:crypto';
import { ForwardEmailClient, type EmailSendRequest } from './forward-email';
import { isAllowedOauthHostname, parseOrigins } from './login-script';

export const CONTACT_SUBJECTS = ['general', 'sales', 'support', 'partnership'] as const;
export type ContactSubject = (typeof CONTACT_SUBJECTS)[number];

export interface ContactInquiryInput {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export interface ContactInquiryResult {
  id: string;
  status: 'sent';
}

export type ContactValidationError = { ok: false; status: 400; error: string };
export type ContactOk = { ok: true; value: ContactInquiryInput };

const SUBJECT_LABELS: Record<ContactSubject, string> = {
  general: 'General inquiry',
  sales: 'Sales / demo request',
  support: 'Technical support',
  partnership: 'Partnership',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Reject C0 / DEL. Names: no newlines. Messages: allow LF and tab only. */
export function hasForbiddenControls(value: string, allowMessageWhitespace: boolean): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code === 0x7f) return true;
    if (code >= 0x20) continue;
    if (allowMessageWhitespace && (code === 0x09 || code === 0x0a)) continue;
    return true;
  }
  return false;
}

export function validateContactInquiry(body: unknown): ContactOk | ContactValidationError {
  if (!body || typeof body !== 'object') {
    return { ok: false, status: 400, error: 'Expected a JSON object body.' };
  }
  const record = body as Record<string, unknown>;
  const name = typeof record.name === 'string' ? record.name.trim() : '';
  const email = typeof record.email === 'string' ? record.email.trim() : '';
  const subject = typeof record.subject === 'string' ? record.subject.trim() : '';
  const message = typeof record.message === 'string' ? record.message.trim() : '';

  if (!name || name.length > 120 || hasForbiddenControls(name, false)) {
    return { ok: false, status: 400, error: 'Enter a name (max 120 characters).' };
  }
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return { ok: false, status: 400, error: 'Enter a valid email address.' };
  }
  if (!(CONTACT_SUBJECTS as readonly string[]).includes(subject)) {
    return { ok: false, status: 400, error: 'Select a valid subject.' };
  }
  if (message.length < 10 || message.length > 5000 || hasForbiddenControls(message, true)) {
    return { ok: false, status: 400, error: 'Enter a message of 10–5000 characters.' };
  }

  return {
    ok: true,
    value: { name, email, subject: subject as ContactSubject, message },
  };
}

export function buildContactEmailRequest(
  dto: ContactInquiryInput,
  inbox: string,
  from: string,
  correlationId: string,
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
    to: inbox,
    from,
    replyTo: dto.email,
    // Fixed label only — never interpolate free-text into the Subject header.
    subject: `[Platform Kit] ${subjectLabel}`,
    text,
    correlationId,
  };
}

export async function submitContactInquiry(
  dto: ContactInquiryInput,
  email: ForwardEmailClient = new ForwardEmailClient(),
): Promise<ContactInquiryResult> {
  const inbox = process.env.CONTACT_INBOX_EMAIL?.trim();
  const from = process.env.CONTACT_FROM_EMAIL?.trim();
  if (!inbox || !from) {
    throw new Error(
      'Contact inquiry delivery is not configured (CONTACT_INBOX_EMAIL / CONTACT_FROM_EMAIL).',
    );
  }
  if (!email.isConfigured()) {
    throw new Error('FORWARDEMAIL_API_KEY is not configured');
  }

  const id = randomUUID();
  await email.send(buildContactEmailRequest(dto, inbox, from, id));
  return { id, status: 'sent' };
}

/** CORS: reflect Origin when it matches the Decap ORIGINS allowlist. */
export function contactCorsHeaders(requestOrigin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Max-Age': '86400',
  };
  if (!requestOrigin) return headers;

  let allowlist: string[];
  try {
    allowlist = parseOrigins(process.env.ORIGINS);
  } catch {
    return headers;
  }

  try {
    const host = new URL(requestOrigin).host;
    if (isAllowedOauthHostname(host, allowlist)) {
      headers['Access-Control-Allow-Origin'] = requestOrigin;
      headers.Vary = 'Origin';
    }
  } catch {
    return headers;
  }
  return headers;
}
