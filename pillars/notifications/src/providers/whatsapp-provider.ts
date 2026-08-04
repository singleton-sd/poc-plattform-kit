/**
 * WhatsApp Business messaging — default Meta WhatsApp Cloud API.
 * Adapter interface allows swapping providers later without changing callers.
 * https://developers.facebook.com/docs/whatsapp/cloud-api
 */

export interface WhatsAppSendRequest {
  to: string;
  templateName?: string;
  text?: string;
  correlationId?: string;
}

export interface WhatsAppSendResult {
  providerMessageId: string;
  accepted: boolean;
}

export interface WhatsAppProvider {
  readonly name: 'meta-whatsapp-cloud';
  send(request: WhatsAppSendRequest): Promise<WhatsAppSendResult>;
}

/** Stub — access token in Key Vault; phone-number-id / API version in App Config. */
export class MetaWhatsAppCloudProvider implements WhatsAppProvider {
  readonly name = 'meta-whatsapp-cloud' as const;

  async send(_request: WhatsAppSendRequest): Promise<WhatsAppSendResult> {
    throw new Error('MetaWhatsAppCloudProvider not configured (stub)');
  }
}
