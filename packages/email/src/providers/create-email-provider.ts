import { DevelopmentEmailProvider } from './development-email.provider';
import { loadContactEmailProfile } from '../contact/contact-email-profile';
import type { EmailProvider, EmailProviderName } from './email-types';
import { ForwardEmailProvider } from './forward-email.provider';

export interface EmailRuntimeConfig {
  provider: EmailProviderName;
  fromAddress: string;
  fromName: string;
  contactInboxAddress: string;
  forwardEmailTokenConfigured: boolean;
}

/**
 * Resolve non-secret email configuration.
 * Prefer EMAIL_* / CONTACT_INBOX_ADDRESS; accept legacy CONTACT_* aliases.
 */
export function loadEmailRuntimeConfig(env: NodeJS.ProcessEnv = process.env): EmailRuntimeConfig {
  const profile = loadContactEmailProfile(env);
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

  const fromAddress = profile.fromAddress;
  const fromName = profile.fromName;
  const contactInboxAddress =
    env.CONTACT_INBOX_ADDRESS?.trim() || env.CONTACT_INBOX_EMAIL?.trim() || '';

  const forwardEmailTokenConfigured = Boolean(
    env.FORWARD_EMAIL_TOKEN?.trim() || env.FORWARDEMAIL_API_KEY?.trim(),
  );

  return {
    provider,
    fromAddress,
    fromName,
    contactInboxAddress,
    forwardEmailTokenConfigured,
  };
}

export function createEmailProvider(env: NodeJS.ProcessEnv = process.env): EmailProvider {
  const config = loadEmailRuntimeConfig(env);
  if (config.provider === 'forward-email') {
    return new ForwardEmailProvider({
      apiToken: env.FORWARD_EMAIL_TOKEN ?? env.FORWARDEMAIL_API_KEY,
      baseUrl: env.FORWARD_EMAIL_BASE_URL ?? env.FORWARDEMAIL_BASE_URL,
    });
  }
  return new DevelopmentEmailProvider();
}
