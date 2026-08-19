import { DevelopmentEmailProvider } from './development-email.provider';
import type { EmailProvider, EmailProviderName } from './email-types';
import { ForwardEmailProvider } from './forward-email.provider';

export interface EmailRuntimeConfig {
  provider: EmailProviderName;
  fromAddress: string;
  fromName: string;
  contactInboxAddress: string;
  forwardEmailTokenConfigured: boolean;
  /**
   * BIMI selector used by mailbox providers to fetch `<selector>._bimi.<domain>`
   * (unless `selector` is `default` and the header is omitted).
   */
  bimiSelector: string;
  /** HTTPS URL served publicly as the BIMI indicator (SVG Tiny-PS). */
  bimiLogoUrl?: string;
  /** Optional BIMI brand name (used for ops/docs/config display only). */
  bimiBrandName?: string;
  /**
   * Domain used for BIMI DNS lookup and for the RFC5322 `From:` domain
   * (usually derived from `fromAddress`).
   */
  bimiSendingDomain: string;
  /** Optional BIMI evidence / certificate PEM URL. */
  bimiEvidenceUrl?: string;
}

/**
 * Resolve non-secret email configuration.
 * Prefer EMAIL_* / CONTACT_INBOX_ADDRESS; accept legacy CONTACT_* aliases.
 */
export function loadEmailRuntimeConfig(env: NodeJS.ProcessEnv = process.env): EmailRuntimeConfig {
  const explicit = (env.EMAIL_PROVIDER ?? '').trim().toLowerCase();
  let provider: EmailProviderName;
  if (explicit === 'forward-email' || explicit === 'forwardemail') {
    provider = 'forward-email';
  } else if (explicit === 'development' || explicit === 'dev') {
    provider = 'development';
  } else if (env.NODE_ENV === 'production') {
    // Production must opt into Forward Email explicitly via EMAIL_PROVIDER or
    // by having a token *and* not running a PR preview marker.
    provider = env.EMAIL_ALLOW_PRODUCTION_SEND === 'true' ? 'forward-email' : 'development';
  } else {
    provider = 'development';
  }

  const fromAddressRaw =
    env.EMAIL_FROM_ADDRESS?.trim() || env.CONTACT_FROM_EMAIL?.trim() || 'noreply@example.invalid';
  const fromName = env.EMAIL_FROM_NAME?.trim() || 'Plattform Kit';
  const contactInboxAddress =
    env.CONTACT_INBOX_ADDRESS?.trim() || env.CONTACT_INBOX_EMAIL?.trim() || 'hello@singletonsd.com';

  const bimiSelector = (env.EMAIL_BIMI_SELECTOR?.trim() || 'default').toLowerCase();
  const bimiLogoUrl = env.EMAIL_LOGO_URL?.trim() || undefined;
  const bimiBrandName = env.EMAIL_BRAND_NAME?.trim() || fromName;
  const derivedSendingDomain = fromAddressRaw.split('@')[1] ?? '';
  const bimiSendingDomain = env.EMAIL_SENDING_DOMAIN?.trim() || derivedSendingDomain;
  const bimiEvidenceUrl = env.EMAIL_BIMI_EVIDENCE_URL?.trim() || undefined;

  // BIMI providers fetch `<selector>._bimi.<FromDomain>` — so ensure the
  // runtime `From:` domain matches EMAIL_SENDING_DOMAIN when it is set.
  const fromAddress =
    bimiSendingDomain && fromAddressRaw.includes('@')
      ? `${fromAddressRaw.split('@')[0]}@${bimiSendingDomain}`
      : fromAddressRaw;

  const forwardEmailTokenConfigured = Boolean(
    env.FORWARD_EMAIL_TOKEN?.trim() || env.FORWARDEMAIL_API_KEY?.trim(),
  );

  return {
    provider,
    fromAddress,
    fromName,
    contactInboxAddress,
    forwardEmailTokenConfigured,
    bimiSelector,
    bimiLogoUrl,
    bimiBrandName,
    bimiSendingDomain,
    bimiEvidenceUrl,
  };
}

export function createEmailProvider(env: NodeJS.ProcessEnv = process.env): EmailProvider {
  const config = loadEmailRuntimeConfig(env);
  if (config.provider === 'forward-email') {
    return new ForwardEmailProvider({
      apiToken: env.FORWARD_EMAIL_TOKEN ?? env.FORWARDEMAIL_API_KEY,
      baseUrl: env.FORWARD_EMAIL_BASE_URL ?? env.FORWARDEMAIL_BASE_URL,
      bimiSelector: config.bimiSelector,
    });
  }
  return new DevelopmentEmailProvider();
}
