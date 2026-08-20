import { EmailProviderError } from '../providers/email-types';
import { loadEmailRuntimeConfig } from '../providers/create-email-provider';

export type ContactEmailProfile = {
  fromAddress: string;
  fromName: string;
  contactInboxAddress: string;
};

/** Optional sender fields from tenant/PoC `settings.email`. */
export type TenantEmailProfileOverride = Partial<ContactEmailProfile>;

const EMAIL_RE = /^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/;

type HostProfileMap = Record<string, TenantEmailProfileOverride>;

type HostProfileCacheEntry = {
  raw: string;
  providerName: 'forward-email' | 'development';
  value: HostProfileMap;
};

/** Module-level cache: same env JSON is not re-parsed on every contact submit. */
let hostProfileCache: HostProfileCacheEntry | null = null;

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
): HostProfileMap {
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

  const out: HostProfileMap = {};
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

/** Cached parse of `CONTACT_EMAIL_PROFILES_BY_HOST` (keyed by raw JSON + provider). */
export function getHostProfileMap(
  raw: string | undefined,
  providerName: 'forward-email' | 'development',
): HostProfileMap {
  const cacheKey = raw ?? '';
  if (
    hostProfileCache &&
    hostProfileCache.raw === cacheKey &&
    hostProfileCache.providerName === providerName
  ) {
    return hostProfileCache.value;
  }
  const value = parseHostProfileMap(raw, providerName);
  hostProfileCache = { raw: cacheKey, providerName, value };
  return value;
}

/** Test/helper: drop the memoized host map (e.g. after mutating process.env in tests). */
export function clearHostProfileMapCache(): void {
  hostProfileCache = null;
}

/**
 * Shared parser for tenant/PoC `settings.email` sender overrides.
 * Returns `undefined` when no usable email fields are present.
 */
export function resolveTenantEmailProfileOverride(
  settings: Record<string, unknown> | null | undefined,
): TenantEmailProfileOverride | undefined {
  if (!settings || !isRecord(settings.email)) return undefined;
  const email = settings.email;
  const fromAddress = cleanString(email.fromAddress);
  const fromName = cleanString(email.fromName);
  const contactInboxAddress = cleanString(email.contactInboxAddress);

  if (!fromAddress && !fromName && !contactInboxAddress) return undefined;

  return { fromAddress, fromName, contactInboxAddress };
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
      const hostProfiles = getHostProfileMap(env.CONTACT_EMAIL_PROFILES_BY_HOST, providerName);
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
