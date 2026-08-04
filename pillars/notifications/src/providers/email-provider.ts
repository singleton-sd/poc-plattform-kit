/** Outbound email via Forward Email API — https://forwardemail.net/en/email-api */

export interface EmailSendRequest {
  to: string | string[];
  from: string;
  subject: string;
  text?: string;
  html?: string;
  correlationId?: string;
}

export interface EmailSendResult {
  providerMessageId: string;
  accepted: boolean;
}

export interface EmailProvider {
  readonly name: 'forward-email';
  send(request: EmailSendRequest): Promise<EmailSendResult>;
}

/** Stub — real HTTP client wired when credentials exist in Key Vault. */
export class ForwardEmailProvider implements EmailProvider {
  readonly name = 'forward-email' as const;

  async send(_request: EmailSendRequest): Promise<EmailSendResult> {
    throw new Error('ForwardEmailProvider not configured (stub)');
  }
}
