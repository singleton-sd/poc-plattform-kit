export type DmarcPolicy = 'none' | 'quarantine' | 'reject';

export interface TransactionalEmailAuthProfile {
  fromAddress: string;
  fromName: string;
  sendingDomain: string;
  dkimSelector: string;
  dmarcPolicy: DmarcPolicy;
  dmarcAggregateReportAddress: string;
}

export function loadTransactionalEmailAuthProfile(
  env: NodeJS.ProcessEnv = process.env,
): TransactionalEmailAuthProfile {
  const fromAddress = (env.EMAIL_FROM_ADDRESS ?? env.CONTACT_FROM_EMAIL ?? '').trim();
  const fromName = (env.EMAIL_FROM_NAME ?? env.EMAIL_BRAND_NAME ?? 'Transactional Email').trim();
  const sendingDomain = (env.EMAIL_SENDING_DOMAIN ?? extractEmailDomain(fromAddress) ?? '')
    .trim()
    .toLowerCase();
  const dkimSelector = (env.EMAIL_DKIM_SELECTOR ?? 'fe').trim();
  const dmarcPolicy = normalizeDmarcPolicy(env.EMAIL_DMARC_POLICY);
  const dmarcAggregateReportAddress = (env.EMAIL_DMARC_RUA ?? '').trim();

  return {
    fromAddress,
    fromName,
    sendingDomain,
    dkimSelector,
    dmarcPolicy,
    dmarcAggregateReportAddress,
  };
}

export function validateTransactionalEmailAuthProfile(
  profile: TransactionalEmailAuthProfile,
): string[] {
  const errors: string[] = [];

  if (!profile.fromAddress) {
    errors.push('EMAIL_FROM_ADDRESS is required');
  }
  if (!profile.sendingDomain) {
    errors.push('EMAIL_SENDING_DOMAIN is required (or derive it from EMAIL_FROM_ADDRESS)');
  }

  const fromDomain = extractEmailDomain(profile.fromAddress);
  if (profile.sendingDomain && fromDomain && !isDomainAligned(fromDomain, profile.sendingDomain)) {
    errors.push('EMAIL_FROM_ADDRESS must align with EMAIL_SENDING_DOMAIN');
  }
  if (
    profile.dmarcAggregateReportAddress &&
    !profile.dmarcAggregateReportAddress.startsWith('mailto:')
  ) {
    errors.push('EMAIL_DMARC_RUA must start with "mailto:"');
  }

  return errors;
}

/** Validate a resolved sender address against the configured sending domain. */
export function validateResolvedSenderDomainAlignment(
  fromAddress: string,
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const authProfile = loadTransactionalEmailAuthProfile(env);
  const errors = validateTransactionalEmailAuthProfile(authProfile);
  if (errors.length > 0) {
    return errors;
  }

  const fromDomain = extractEmailDomain(fromAddress);
  if (
    authProfile.sendingDomain &&
    fromDomain &&
    !isDomainAligned(fromDomain, authProfile.sendingDomain)
  ) {
    return ['Resolved fromAddress must align with EMAIL_SENDING_DOMAIN'];
  }

  return [];
}

export function extractEmailDomain(address: string): string | null {
  const at = address.lastIndexOf('@');
  if (at < 1 || at === address.length - 1) return null;
  return address
    .slice(at + 1)
    .trim()
    .toLowerCase();
}

function normalizeDmarcPolicy(value: string | undefined): DmarcPolicy {
  const normalized = (value ?? '').trim().toLowerCase();
  if (normalized === 'none' || normalized === 'quarantine' || normalized === 'reject') {
    return normalized;
  }
  return 'quarantine';
}

function isDomainAligned(fromDomain: string, sendingDomain: string): boolean {
  return fromDomain === sendingDomain || fromDomain.endsWith(`.${sendingDomain}`);
}
