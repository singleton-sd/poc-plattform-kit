export type {
  EmailProvider,
  EmailProviderErrorKind,
  EmailProviderName,
  EmailSendRequest,
  EmailSendResult,
  EmailRuntimeConfig,
  ForwardEmailProviderOptions,
  DevelopmentEmailProviderOptions,
  ContactInquiryInput,
  ContactSubject,
  ContactValidationResult,
  ForwardEmailAliasSummary,
  ForwardEmailDnsRecord,
  ForwardEmailDomainSummary,
  ForwardEmailManagementClientOptions,
} from '@poc-plattform-kit/email';
export {
  assertSafeEmailHeader,
  createEmailProvider,
  DevelopmentEmailProvider,
  EmailProviderError,
  formatFromHeader,
  ForwardEmailProvider,
  loadEmailRuntimeConfig,
  sanitizeHeaderValue,
  CONTACT_SUBJECTS,
  buildContactEmailRequest,
  hasForbiddenControls,
  sendContactInquiryEmail,
  validateContactInquiry,
  ForwardEmailManagementClient,
  getRequiredDnsRecords,
  mergeSpfInclude,
} from '@poc-plattform-kit/email';

export type { SmsProvider, SmsSendRequest, SmsSendResult } from './providers/sms-provider';
export { AndroidSmsGatewayProvider } from './providers/sms-provider';

export type {
  WhatsAppProvider,
  WhatsAppSendRequest,
  WhatsAppSendResult,
} from './providers/whatsapp-provider';
export { MetaWhatsAppCloudProvider } from './providers/whatsapp-provider';
