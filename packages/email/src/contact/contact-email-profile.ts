import { EmailProviderError } from '../providers/email-types';
import { loadEmailRuntimeConfig } from '../providers/create-email-provider';

export type ContactEmailProfile = {
  fromAddress: string;
  fromName: string;
  contactInboxAddress: string;
};

const EMAIL_RE = /^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function cleanString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function assertEmail(value: string, field: string): string {
  if (!EMAIL_RE.test(value)) {
    throw new EmailProviderError({
      message: `${field} must be a valid email address`,
      kind: 'configuration',
      provider: 'forward-email',
    });
  }
  return value;
}

function parseHostProfileMap(
  raw: string | undefined,
  providerName: 'forward-email' | 'development',
): Record<string, Partial<ContactEmailProfile>> {
  if (!raw?.trim()) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new EmailProviderError({
      message: 'CONTACT_EMAIL_PROFILES_BY_HOST must be valid JSON',
      kind: 'configuration',
      provider: providerName,
    });
  }
  if (!isRecord(parsed)) {
    throw new EmailProviderError({
      message: 'CONTACT_EMAIL_PROFILES_BY_HOST must be an object map by host',
      kind: 'configuration',
      provider: providerName,
    });
  }

  const out: Record<string, Partial<ContactEmailProfile>> = {};
  for (const [host, profile] of Object.entries(parsed)) {
    if (!isRecord(profile)) continue;
    out[host.toLowerCase()] = {
      fromAddress: cleanString(profile.fromAddress),
      fromName: cleanString(profile.fromName),
      contactInboxAddress: cleanString(profile.contactInboxAddress),
    };
  }
  return out;
}

export function resolveTenantEmailProfileOverride(
  settings: Record<string, unknown> | null | undefined,
): Partial<ContactEmailProfile> | undefined {
  if (!settings || !isRecord(settings.email)) return undefined;
  const email = settings.email;
  return {
    fromAddress: cleanString(email.fromAddress),
    fromName: cleanString(email.fromName),
    contactInboxAddress: cleanString(email.contactInboxAddress),
  };
}

export function resolveContactEmailProfile(
  options: {
    env?: NodeJS.ProcessEnv;
    tenantSettings?: Record<string, unknown> | null;
    requestOrigin?: string | null;
  } = {},
): ContactEmailProfile {
  const env = options.env ?? process.env;
  const config = loadEmailRuntimeConfig(env);
  const providerName = config.provider;

  const resolved: ContactEmailProfile = {
    fromAddress: config.fromAddress,
    fromName: config.fromName,
    contactInboxAddress: config.contactInboxAddress,
  };

  const tenantOverride = resolveTenantEmailProfileOverride(options.tenantSettings);
  if (tenantOverride?.fromAddress) resolved.fromAddress = tenantOverride.fromAddress;
  if (tenantOverride?.fromName) resolved.fromName = tenantOverride.fromName;
  if (tenantOverride?.contactInboxAddress) {
    resolved.contactInboxAddress = tenantOverride.contactInboxAddress;
  }

  const requestOrigin = options.requestOrigin;
  if (requestOrigin) {
    let host: string | null = null;
    try {
      host = new URL(requestOrigin).host.toLowerCase();
    } catch {
      // Invalid Origin input should not block fallback profile resolution.
    }
    if (host) {
      const hostProfiles = parseHostProfileMap(env.CONTACT_EMAIL_PROFILES_BY_HOST, providerName);
      const hostOverride = hostProfiles[host];
      if (hostOverride?.fromAddress) resolved.fromAddress = hostOverride.fromAddress;
      if (hostOverride?.fromName) resolved.fromName = hostOverride.fromName;
      if (hostOverride?.contactInboxAddress) {
        resolved.contactInboxAddress = hostOverride.contactInboxAddress;
      }
    }
  }

  return {
    fromAddress: assertEmail(resolved.fromAddress, 'fromAddress'),
    fromName: resolved.fromName,
    contactInboxAddress: assertEmail(resolved.contactInboxAddress, 'contactInboxAddress'),
  };
}
