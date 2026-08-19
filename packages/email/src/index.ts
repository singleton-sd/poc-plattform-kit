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
export type { ContactEmailProfile, DmarcPolicy } from './contact/contact-email-profile';
export {
  CONTACT_SUBJECTS,
  buildContactEmailRequest,
  hasForbiddenControls,
  sendContactInquiryEmail,
  validateContactInquiry,
} from './contact/contact-email';
export {
  extractEmailDomain,
  loadContactEmailProfile,
  validateContactEmailProfile,
} from './contact/contact-email-profile';

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
