export interface BimiDnsSettings {
  /**
   * BIMI selector label (DNS is `<selector>._bimi.<sendingDomain>`).
   * Use `default` to avoid stamping a `BIMI-Selector` header on every message.
   */
  selector: string;
  /** Domain part used in the RFC5322 `From:` header (e.g. `mail.example.com`). */
  sendingDomain: string;
  /** HTTPS URL to the BIMI indicator SVG (Tiny-PS / Portable-Secure). */
  logoUrl: string;
  /**
   * Optional BIMI evidence / certificate PEM URL (VMC or CMC).
   * When omitted, the record is published with an empty `a=` tag.
   */
  evidenceUrl?: string;
}

export function assertValidBimiSelector(selector: string): string {
  const trimmed = selector.trim();
  if (!trimmed) throw new Error('BIMI selector is required');
  if (trimmed.endsWith('.')) {
    throw new Error(`Invalid BIMI selector: ${trimmed}`);
  }

  const labels = trimmed.split('.');
  for (const label of labels) {
    if (!isValidBimiSelectorLabel(label)) {
      throw new Error(`Invalid BIMI selector: ${trimmed}`);
    }
  }

  return trimmed;
}

function isValidBimiSelectorLabel(label: string): boolean {
  if (label.length === 0 || label.length > 63) return false;
  if (label.includes('_')) return false;
  return /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(label);
}

function assertHttpsUrl(url: string, fieldName = 'BIMI URL'): string {
  const trimmed = url.trim();
  if (!trimmed) throw new Error(`${fieldName} is required`);
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`Invalid ${fieldName}: ${trimmed}`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`${fieldName} must use HTTPS: ${trimmed}`);
  }
  return trimmed;
}

export function buildBimiDnsRecordName(settings: BimiDnsSettings): string {
  const selector = assertValidBimiSelector(settings.selector);
  const sendingDomain = settings.sendingDomain.trim();
  if (!sendingDomain) throw new Error('BIMI sendingDomain is required');
  return `${selector}._bimi.${sendingDomain}`;
}

/**
 * BIMI DNS TXT record *value* (what goes inside the TXT record).
 *
 * See https://datatracker.ietf.org/doc/draft-brand-indicators-for-message-identification/
 */
export function buildBimiTxtValue(settings: BimiDnsSettings): string {
  const selector = assertValidBimiSelector(settings.selector);
  const logoUrl = assertHttpsUrl(settings.logoUrl, 'BIMI logoUrl');
  // `selector` is only needed for validation; BIMI TXT format does not include it.
  void selector;

  const evidence = settings.evidenceUrl?.trim();
  const evidencePart = evidence ? `a=${assertHttpsUrl(evidence, 'BIMI evidenceUrl')}` : 'a=';
  return `v=BIMI1; l=${logoUrl}; ${evidencePart}`;
}

/**
 * Minimal BIMI-Selector header value for RFC5322 message injection.
 *
 * Mailbox providers look at `default._bimi.<fromDomain>` when this header is
 * absent; otherwise they use the selector after `s=`.
 */
export function buildBimiSelectorHeaderValue(selector: string): string {
  const resolved = assertValidBimiSelector(selector);
  return `v=BIMI1; s=${resolved}`;
}
