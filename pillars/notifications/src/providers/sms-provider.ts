/**
 * Outbound SMS via self-hosted android-sms-gateway HTTP API.
 * https://github.com/capcom6/android-sms-gateway
 */

export interface SmsSendRequest {
  to: string;
  message: string;
  correlationId?: string;
}

export interface SmsSendResult {
  providerMessageId: string;
  accepted: boolean;
}

export interface SmsProvider {
  readonly name: 'android-sms-gateway';
  send(request: SmsSendRequest): Promise<SmsSendResult>;
}

/** Stub — base URL in App Config; username/password in Key Vault. */
export class AndroidSmsGatewayProvider implements SmsProvider {
  readonly name = 'android-sms-gateway' as const;

  async send(_request: SmsSendRequest): Promise<SmsSendResult> {
    throw new Error('AndroidSmsGatewayProvider not configured (stub)');
  }
}
