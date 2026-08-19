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
  hasForbiddenControls,
  sendContactInquiryEmail,
  validateContactInquiry,
} from './contact/contact-email';

export { BIMI_LOGO_SVG } from './bimi/bimi-logo';
export {
  assertValidBimiSelector,
  buildBimiDnsRecordName,
  buildBimiSelectorHeaderValue,
  buildBimiTxtValue,
  type BimiDnsSettings,
} from './bimi/bimi-dns';

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
