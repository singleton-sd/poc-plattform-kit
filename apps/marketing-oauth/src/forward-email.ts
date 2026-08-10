/**
 * Outbound email via Forward Email API — https://forwardemail.net/en/email-api
 *
 * Intentionally duplicated from pillars/notifications ForwardEmailProvider:
 * Function zip deploy only packs apps/marketing-oauth (no workspace packages).
 * Keep Basic-auth /v1/emails + field names in sync when either side changes
 * (follow-up: shared package once packaging allows).
 */

export interface EmailSendRequest {
  to: string | string[];
  from: string;
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
  correlationId?: string;
}

export interface EmailSendResult {
  providerMessageId: string;
  accepted: boolean;
}

type FetchLike = typeof fetch;

export interface ForwardEmailClientOptions {
  apiKey?: string;
  baseUrl?: string;
  fetchImpl?: FetchLike;
}

export class ForwardEmailClient {
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;

  constructor(options: ForwardEmailClientOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.FORWARDEMAIL_API_KEY;
    this.baseUrl = (
      options.baseUrl ??
      process.env.FORWARDEMAIL_BASE_URL ??
      'https://api.forwardemail.net'
    ).replace(/\/$/, '');
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey?.trim());
  }

  async send(request: EmailSendRequest): Promise<EmailSendResult> {
    const apiKey = this.apiKey?.trim();
    if (!apiKey) {
      throw new Error('FORWARDEMAIL_API_KEY is not configured');
    }

    const to = Array.isArray(request.to) ? request.to.join(',') : request.to;
    const body = new URLSearchParams();
    body.set('from', request.from);
    body.set('to', to);
    body.set('subject', request.subject);
    if (request.text) body.set('text', request.text);
    if (request.html) body.set('html', request.html);
    if (request.replyTo) body.set('replyTo', request.replyTo);

    const authorization = `Basic ${Buffer.from(`${apiKey}:`, 'utf8').toString('base64')}`;
    const response = await this.fetchImpl(`${this.baseUrl}/v1/emails`, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(request.correlationId ? { 'X-Correlation-Id': request.correlationId } : {}),
      },
      body,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(
        `Forward Email send failed (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`,
      );
    }

    const payload = (await response.json().catch(() => ({}))) as {
      id?: string;
      messageId?: string;
    };
    const providerMessageId = payload.id ?? payload.messageId ?? `accepted-${Date.now()}`;
    return { providerMessageId, accepted: true };
  }
}
