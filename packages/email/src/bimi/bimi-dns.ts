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
  // Conservative subset: ASCII letters/digits and DNS-safe separators.
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(trimmed)) {
    throw new Error(`Invalid BIMI selector: ${trimmed}`);
  }
  return trimmed;
}

function assertHttpsUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) throw new Error('BIMI logoUrl is required');
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`Invalid BIMI URL: ${trimmed}`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`BIMI URL must use HTTPS: ${trimmed}`);
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
  const logoUrl = assertHttpsUrl(settings.logoUrl);
  // `selector` is only needed for validation; BIMI TXT format does not include it.
  void selector;

  const evidence = settings.evidenceUrl?.trim();
  const evidencePart = evidence ? `a=${evidence}` : 'a=';
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
