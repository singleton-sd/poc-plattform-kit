export type {
  EmailProvider,
  EmailProviderErrorKind,
  EmailProviderName,
  EmailSendRequest,
  EmailSendResult,
  EmailRuntimeConfig,
  ForwardEmailProviderOptions,
  DevelopmentEmailProviderOptions,
} from './providers/email-provider';
export {
  assertSafeEmailHeader,
  createEmailProvider,
  DevelopmentEmailProvider,
  EmailProviderError,
  formatFromHeader,
  ForwardEmailProvider,
  loadEmailRuntimeConfig,
  sanitizeHeaderValue,
} from './providers/email-provider';

export type {
  ContactInquiryInput,
  ContactSubject,
  ContactValidationResult,
} from './contact/contact-email';
export {
  CONTACT_SUBJECTS,
  buildContactEmailRequest,
  sendContactInquiryEmail,
  validateContactInquiry,
} from './contact/contact-email';

export type {
  ForwardEmailAliasSummary,
  ForwardEmailDnsRecord,
  ForwardEmailDomainSummary,
  ForwardEmailManagementClientOptions,
} from './provisioning/forward-email-management';
export {
  ForwardEmailManagementClient,
  getRequiredDnsRecords,
  mergeSpfInclude,
} from './provisioning/forward-email-management';

export type { SmsProvider, SmsSendRequest, SmsSendResult } from './providers/sms-provider';
export { AndroidSmsGatewayProvider } from './providers/sms-provider';

export type {
  WhatsAppProvider,
  WhatsAppSendRequest,
  WhatsAppSendResult,
} from './providers/whatsapp-provider';
export { MetaWhatsAppCloudProvider } from './providers/whatsapp-provider';
