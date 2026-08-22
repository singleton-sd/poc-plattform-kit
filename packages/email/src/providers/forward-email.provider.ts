import {
  assertSafeEmailHeader,
  EmailProviderError,
  formatFromHeader,
  type EmailProvider,
  type EmailSendRequest,
  type EmailSendResult,
} from './email-types';
import { buildBimiSelectorHeaderValue } from '../bimi/bimi-dns';

type FetchLike = typeof fetch;

export interface ForwardEmailProviderOptions {
  /** Prefer `FORWARD_EMAIL_TOKEN`. Legacy `FORWARDEMAIL_API_KEY` is also accepted. */
  apiToken?: string;
  baseUrl?: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  maxRetries?: number;
  logger?: Pick<Console, 'info' | 'warn' | 'error'>;
  /**
   * BIMI selector to stamp into outbound messages.
   *
   * When unset or set to `default`, the sender can rely on
   * `default._bimi.<fromDomain>` without a custom header.
   */
  bimiSelector?: string;
}

function resolveApiToken(explicit?: string): string | undefined {
  const raw = explicit ?? process.env.FORWARD_EMAIL_TOKEN ?? process.env.FORWARDEMAIL_API_KEY;
  const trimmed = raw?.trim();
  return trimmed || undefined;
}

function classifyHttpStatus(status: number): {
  kind: EmailProviderError['kind'];
  retryable: boolean;
} {
  if (status === 429) return { kind: 'rate_limit', retryable: true };
  if (status >= 500) return { kind: 'transient', retryable: true };
  if (status === 408 || status === 409) return { kind: 'transient', retryable: true };
  return { kind: 'permanent', retryable: false };
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Forward Email HTTP outbound sender.
 * Auth: HTTP Basic with API token as username and empty password.
 * @see https://forwardemail.net/en/email-api
 */
export class ForwardEmailProvider implements EmailProvider {
  readonly name = 'forward-email' as const;
  private readonly apiToken: string | undefined;
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly logger: Pick<Console, 'info' | 'warn' | 'error'>;
  private readonly bimiSelector?: string;

  constructor(options: ForwardEmailProviderOptions = {}) {
    this.apiToken = resolveApiToken(options.apiToken);
    this.baseUrl = (
      options.baseUrl ??
      process.env.FORWARDEMAIL_BASE_URL ??
      process.env.FORWARD_EMAIL_BASE_URL ??
      'https://api.forwardemail.net'
    ).replace(/\/$/, '');
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.maxRetries = options.maxRetries ?? 2;
    this.logger = options.logger ?? console;
    this.bimiSelector = options.bimiSelector?.trim() || undefined;
  }

  isConfigured(): boolean {
    return Boolean(this.apiToken);
  }

  async send(request: EmailSendRequest, signal?: AbortSignal): Promise<EmailSendResult> {
    const apiToken = this.apiToken;
    if (!apiToken) {
      throw new EmailProviderError({
        message: 'FORWARD_EMAIL_TOKEN is not configured',
        kind: 'configuration',
        provider: this.name,
        correlationId: request.correlationId,
      });
    }

    const toList = (Array.isArray(request.to) ? request.to : [request.to]).map((v) =>
      assertSafeEmailHeader(v, 'to'),
    );
    const from = assertSafeEmailHeader(request.from, 'from');
    const subject = assertSafeEmailHeader(request.subject, 'subject');
    const replyTo = request.replyTo ? assertSafeEmailHeader(request.replyTo, 'replyTo') : undefined;
    const fromHeader = formatFromHeader(from, request.fromName);

    const wantsBimiHeader = Boolean(
      this.bimiSelector && this.bimiSelector.toLowerCase() !== 'default',
    );

    const body = new URLSearchParams();
    if (wantsBimiHeader) {
      const bimiValue = buildBimiSelectorHeaderValue(this.bimiSelector as string);
      // Forward Email accepts a full RFC5322 message when passed as `raw=`.
      // This is the most reliable way to ensure the custom BIMI header is
      // present before DKIM signing.
      body.set(
        'raw',
        buildRawEmailMessage({
          toList,
          fromHeader,
          subject,
          replyTo,
          text: request.text,
          html: request.html,
          bimiSelectorHeaderValue: bimiValue,
        }),
      );
    } else {
      body.set('from', fromHeader);
      body.set('to', toList.join(','));
      body.set('subject', subject);
      if (request.text) body.set('text', request.text);
      if (request.html) body.set('html', request.html);
      if (replyTo) body.set('replyTo', replyTo);
    }

    const authorization = `Basic ${Buffer.from(`${apiToken}:`, 'utf8').toString('base64')}`;
    let attempt = 0;
    let lastError: EmailProviderError | undefined;

    while (attempt <= this.maxRetries) {
      if (signal?.aborted) {
        throw new EmailProviderError({
          message: 'Forward Email send cancelled',
          kind: 'cancelled',
          provider: this.name,
          correlationId: request.correlationId,
          retryable: false,
          cause: signal.reason,
        });
      }

      const controller = new AbortController();
      const onAbort = () => controller.abort(signal?.reason);
      signal?.addEventListener('abort', onAbort, { once: true });
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await this.fetchImpl(`${this.baseUrl}/v1/emails`, {
          method: 'POST',
          headers: {
            Authorization: authorization,
            'Content-Type': 'application/x-www-form-urlencoded',
            ...(request.correlationId ? { 'X-Correlation-Id': request.correlationId } : {}),
          },
          body,
          signal: controller.signal,
        });

        const providerRequestId =
          response.headers.get('x-request-id') ??
          response.headers.get('x-response-id') ??
          undefined;

        if (response.ok) {
          const payload = (await response.json().catch(() => ({}))) as {
            id?: string;
            messageId?: string;
          };
          const providerMessageId = payload.id ?? payload.messageId ?? `accepted-${Date.now()}`;
          this.logger.info(
            JSON.stringify({
              msg: 'email.send.accepted',
              provider: this.name,
              operation: 'send',
              statusCode: response.status,
              providerRequestId,
              correlationId: request.correlationId,
              recipientDomain: toList[0]?.split('@')[1],
            }),
          );
          return { providerMessageId, accepted: true };
        }

        const detail = await response.text().catch(() => '');
        const { kind, retryable } = classifyHttpStatus(response.status);
        lastError = new EmailProviderError({
          message: `Forward Email send failed (${response.status})`,
          kind,
          provider: this.name,
          statusCode: response.status,
          providerRequestId,
          correlationId: request.correlationId,
          retryable,
        });
        // Never log response bodies (may echo content) or auth headers.
        this.logger.warn(
          JSON.stringify({
            msg: 'email.send.failed',
            provider: this.name,
            operation: 'send',
            statusCode: response.status,
            errorKind: kind,
            providerRequestId,
            correlationId: request.correlationId,
            recipientDomain: toList[0]?.split('@')[1],
            detailLength: detail.length,
            attempt,
          }),
        );

        if (!retryable || attempt >= this.maxRetries) throw lastError;
      } catch (error) {
        if (error instanceof EmailProviderError) {
          if (!error.retryable || attempt >= this.maxRetries) throw error;
          lastError = error;
        } else if (signal?.aborted || (error instanceof Error && error.name === 'AbortError')) {
          throw new EmailProviderError({
            message: 'Forward Email send cancelled or timed out',
            kind: signal?.aborted ? 'cancelled' : 'transient',
            provider: this.name,
            correlationId: request.correlationId,
            retryable: !signal?.aborted,
            cause: error,
          });
        } else {
          lastError = new EmailProviderError({
            message: 'Forward Email send transport failure',
            kind: 'transient',
            provider: this.name,
            correlationId: request.correlationId,
            retryable: true,
            cause: error,
          });
          if (attempt >= this.maxRetries) throw lastError;
        }
      } finally {
        clearTimeout(timeout);
        signal?.removeEventListener('abort', onAbort);
      }

      attempt += 1;
      const backoffMs = Math.min(2000, 250 * 2 ** attempt);
      await sleep(backoffMs, signal);
    }

    throw (
      lastError ??
      new EmailProviderError({
        message: 'Forward Email send failed',
        kind: 'transient',
        provider: this.name,
        correlationId: request.correlationId,
      })
    );
  }
}

function normalizeToCrlf(value: string): string {
  // Keep body content intact; only normalize line endings.
  return value.replace(/\r?\n/g, '\r\n');
}

/** Printable ASCII (tab + CR/LF + 0x20-0x7E) is safe for `charset=utf-8` + `7bit`. */
const ASCII_7BIT_BODY = /^[\t\r\n\x20-\x7E]*$/;

function isAscii7BitBody(content: string): boolean {
  return ASCII_7BIT_BODY.test(content);
}

function encodeQuotedPrintableLine(line: string): string {
  let encoded = '';
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]!;
    const code = char.charCodeAt(0);
    const isTrailingWhitespace = (code === 32 || code === 9) && i === line.length - 1;
    const mustEncode = char === '=' || code < 32 || code > 126 || isTrailingWhitespace;
    if (mustEncode) {
      for (const byte of Buffer.from(char, 'utf8')) {
        encoded += `=${byte.toString(16).toUpperCase().padStart(2, '0')}`;
      }
    } else {
      encoded += char;
    }
  }
  return wrapQuotedPrintableLine(encoded);
}

function wrapQuotedPrintableLine(line: string): string {
  if (line.length <= 76) return line;

  const parts: string[] = [];
  let pos = 0;
  while (pos < line.length) {
    let chunkLen = Math.min(76, line.length - pos);
    while (chunkLen > 0 && pos + chunkLen < line.length && line[pos + chunkLen - 1] === '=') {
      chunkLen -= 1;
    }
    parts.push(`${line.slice(pos, pos + chunkLen)}=`);
    pos += chunkLen;
  }
  return parts.join('\r\n');
}

function encodeQuotedPrintable(content: string): string {
  const normalized = normalizeToCrlf(content);
  return normalized
    .split('\r\n')
    .map((line) => encodeQuotedPrintableLine(line))
    .join('\r\n');
}

function encodeMimeBodyPart(content: string): {
  transferEncoding: '7bit' | 'quoted-printable';
  body: string;
} {
  const normalized = normalizeToCrlf(content);
  if (isAscii7BitBody(normalized)) {
    return { transferEncoding: '7bit', body: normalized };
  }
  return {
    transferEncoding: 'quoted-printable',
    body: encodeQuotedPrintable(normalized),
  };
}

function appendMimeBodyPart(
  lines: string[],
  contentType: 'text/plain' | 'text/html',
  content: string,
): void {
  const { transferEncoding, body } = encodeMimeBodyPart(content);
  lines.push(`Content-Type: ${contentType}; charset=utf-8`);
  lines.push(`Content-Transfer-Encoding: ${transferEncoding}`);
  lines.push('');
  lines.push(body);
}

function buildRawEmailMessage(options: {
  toList: string[];
  fromHeader: string;
  subject: string;
  replyTo?: string;
  text?: string;
  html?: string;
  bimiSelectorHeaderValue: string;
}): string {
  const boundary = `bimi-${Math.random().toString(16).slice(2)}-${Date.now()}`;
  const lines: string[] = [];

  lines.push(`From: ${options.fromHeader}`);
  lines.push(`To: ${options.toList.join(', ')}`);
  lines.push(`Subject: ${options.subject}`);
  if (options.replyTo) lines.push(`Reply-To: ${options.replyTo}`);
  lines.push(`BIMI-Selector: ${options.bimiSelectorHeaderValue}`);
  lines.push('MIME-Version: 1.0');

  const textPart = options.text ?? '';
  const htmlPart = options.html;

  if (htmlPart) {
    lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    lines.push('');
    lines.push(`--${boundary}`);
    appendMimeBodyPart(lines, 'text/plain', textPart);

    lines.push(`--${boundary}`);
    appendMimeBodyPart(lines, 'text/html', htmlPart);

    lines.push(`--${boundary}--`);
    lines.push('');
    return lines.join('\r\n');
  }

  appendMimeBodyPart(lines, 'text/plain', textPart);
  lines.push('');
  return lines.join('\r\n');
}
