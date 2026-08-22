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
export type {
  ContactEmailProfile,
  TenantEmailProfileOverride,
} from './contact/contact-email-profile';
export {
  CONTACT_SUBJECTS,
  buildContactEmailRequest,
  hasForbiddenControls,
  sendContactInquiryEmail,
  validateContactInquiry,
} from './contact/contact-email';
export {
  clearHostProfileMapCache,
  getHostProfileMap,
  resolveContactEmailProfile,
  resolveTenantEmailProfileOverride,
} from './contact/contact-email-profile';

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
  getRequiredBimiDnsRecords,
  getRequiredDnsRecords,
  mergeSpfInclude,
  resolveBimiRoute53Record,
} from './provisioning/forward-email-management';
