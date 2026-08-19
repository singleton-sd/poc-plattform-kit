import { resolveTxt } from 'node:dns/promises';

export type ValidationStatus = 'pass' | 'fail' | 'warn' | 'skip';

export interface EmailDomainBrandingValidationCheck {
  id:
    'config' | 'spf' | 'dkim' | 'dmarc' | 'bimi-record' | 'bimi-logo-https' | 'bimi-svg-structure';
  status: ValidationStatus;
  message: string;
}

export interface EmailDomainBrandingValidationReport {
  ok: boolean;
  checks: EmailDomainBrandingValidationCheck[];
  errors: string[];
  warnings: string[];
}

export interface EmailDomainBrandingValidationConfig {
  domain: string;
  dkimSelector: string;
  expectedDmarcPolicy: 'none' | 'quarantine' | 'reject';
  bimiSelector?: string;
  expectedBimiLogoUrl?: string;
  requireBimiSvg?: boolean;
}

export interface EmailDomainBrandingValidationDependencies {
  dnsResolveTxt?: (hostname: string) => Promise<string[]>;
  fetchImpl?: typeof fetch;
}

interface ParsedBimiRecord {
  locationUrl: string | null;
}

const DEFAULT_BIMI_SELECTOR = 'default';

export async function validateEmailDomainBranding(
  config: EmailDomainBrandingValidationConfig,
  deps: EmailDomainBrandingValidationDependencies = {},
): Promise<EmailDomainBrandingValidationReport> {
  const checks: EmailDomainBrandingValidationCheck[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const dns = deps.dnsResolveTxt ?? resolveTxtFlat;
  const fetchImpl = deps.fetchImpl ?? fetch;

  const configError = validateConfig(config);
  if (configError) {
    pushFail(checks, errors, 'config', configError);
    return { ok: false, checks, errors, warnings };
  }
  pushPass(checks, 'config', 'Configuration values are present and internally consistent.');

  const domain = config.domain.trim().toLowerCase();
  const dkimName = `${config.dkimSelector.trim().toLowerCase()}._domainkey.${domain}`;
  const dmarcName = `_dmarc.${domain}`;
  const bimiSelector = (config.bimiSelector ?? DEFAULT_BIMI_SELECTOR).trim().toLowerCase();
  const bimiName = `${bimiSelector}._bimi.${domain}`;

  const spfRecords = await lookupTxtRecords(dns, domain);
  const spf = spfRecords.find((record) => /^v=spf1\b/i.test(record));
  if (!spf) {
    pushFail(
      checks,
      errors,
      'spf',
      `No SPF TXT record found on ${domain}. Add a TXT record like "v=spf1 include:spf.forwardemail.net -all".`,
    );
  } else if (!/\s(?:-all|~all|\+all|\?all)\s*$/i.test(spf)) {
    pushWarn(
      checks,
      warnings,
      'spf',
      `SPF record on ${domain} does not end with an explicit all-mechanism (-all/~all/?all/+all): ${spf}`,
    );
  } else {
    pushPass(checks, 'spf', `SPF TXT record found on ${domain}.`);
  }

  const dkimRecords = await lookupTxtRecords(dns, dkimName);
  if (!dkimRecords.some((record) => /v=dkim1/i.test(record))) {
    pushFail(
      checks,
      errors,
      'dkim',
      `No DKIM TXT record with "v=DKIM1" found on ${dkimName}. Check the selector and DNS propagation.`,
    );
  } else {
    pushPass(checks, 'dkim', `DKIM TXT record found on ${dkimName}.`);
  }

  const dmarcRecords = await lookupTxtRecords(dns, dmarcName);
  const dmarc = dmarcRecords.find((record) => /^v=dmarc1\b/i.test(record));
  if (!dmarc) {
    pushFail(
      checks,
      errors,
      'dmarc',
      `No DMARC TXT record found on ${dmarcName}. Add a record with "v=DMARC1; p=${config.expectedDmarcPolicy}; ...".`,
    );
  } else {
    const policyMatch = dmarc.match(/(?:^|;)\s*p\s*=\s*([a-z]+)/i)?.[1]?.toLowerCase();
    if (policyMatch !== config.expectedDmarcPolicy) {
      pushFail(
        checks,
        errors,
        'dmarc',
        `DMARC policy mismatch on ${dmarcName}: expected p=${config.expectedDmarcPolicy}, got p=${policyMatch ?? 'missing'}.`,
      );
    } else {
      pushPass(checks, 'dmarc', `DMARC TXT record found with p=${config.expectedDmarcPolicy}.`);
    }
  }

  const bimiRecords = await lookupTxtRecords(dns, bimiName);
  const bimi = bimiRecords.find((record) => /^v=bimi1\b/i.test(record));
  let bimiLogoUrl: string | null = null;

  if (!bimi) {
    pushFail(
      checks,
      errors,
      'bimi-record',
      `No BIMI TXT record found on ${bimiName}. Add a record like "v=BIMI1; l=https://.../logo.svg;".`,
    );
  } else {
    const parsed = parseBimiRecord(bimi);
    bimiLogoUrl = parsed.locationUrl;
    if (!parsed.locationUrl) {
      pushFail(
        checks,
        errors,
        'bimi-record',
        `BIMI TXT record on ${bimiName} is missing the l= logo URL: ${bimi}`,
      );
    } else if (config.expectedBimiLogoUrl && parsed.locationUrl !== config.expectedBimiLogoUrl) {
      pushFail(
        checks,
        errors,
        'bimi-record',
        `BIMI logo URL mismatch on ${bimiName}: expected ${config.expectedBimiLogoUrl}, got ${parsed.locationUrl}.`,
      );
    } else {
      pushPass(checks, 'bimi-record', `BIMI TXT record found on ${bimiName}.`);
    }
  }

  if (!bimiLogoUrl) {
    pushSkip(
      checks,
      'bimi-logo-https',
      'Skipped logo availability check because no BIMI l= URL could be determined.',
    );
    pushSkip(
      checks,
      'bimi-svg-structure',
      'Skipped SVG structure check because no BIMI l= URL could be determined.',
    );
    return { ok: errors.length === 0, checks, errors, warnings };
  }

  if (!bimiLogoUrl.startsWith('https://')) {
    pushFail(
      checks,
      errors,
      'bimi-logo-https',
      `BIMI logo URL must use HTTPS, got: ${bimiLogoUrl}`,
    );
    pushSkip(
      checks,
      'bimi-svg-structure',
      'Skipped SVG structure check because BIMI logo URL is not HTTPS.',
    );
    return { ok: errors.length === 0, checks, errors, warnings };
  }

  const response = await fetchImpl(bimiLogoUrl, { method: 'GET' });
  if (!response.ok) {
    pushFail(
      checks,
      errors,
      'bimi-logo-https',
      `BIMI logo URL returned HTTP ${response.status} ${response.statusText}. URL: ${bimiLogoUrl}`,
    );
    pushSkip(
      checks,
      'bimi-svg-structure',
      'Skipped SVG structure check because BIMI logo could not be downloaded.',
    );
    return { ok: errors.length === 0, checks, errors, warnings };
  }
  pushPass(checks, 'bimi-logo-https', `BIMI logo URL responded successfully: ${bimiLogoUrl}`);

  const svgText = await response.text();
  const svgIssues = validateBimiSvgStructure(svgText);
  if (svgIssues.length > 0) {
    const message = `BIMI SVG structure validation failed: ${svgIssues.join(' ')}`;
    if (config.requireBimiSvg ?? true) {
      pushFail(checks, errors, 'bimi-svg-structure', message);
    } else {
      pushWarn(checks, warnings, 'bimi-svg-structure', message);
    }
  } else {
    pushPass(checks, 'bimi-svg-structure', 'BIMI SVG passed structural checks.');
  }

  return { ok: errors.length === 0, checks, errors, warnings };
}

export function validateBimiSvgStructure(svgText: string): string[] {
  const issues: string[] = [];
  const normalized = svgText.trim();

  if (!/<svg[\s>]/i.test(normalized)) {
    issues.push('Missing <svg> root element.');
    return issues;
  }

  const svgRootMatch = normalized.match(/<svg\b[^>]*>/i);
  const svgRoot = svgRootMatch?.[0] ?? '';
  if (!/\bbaseProfile\s*=\s*["']tiny-ps["']/i.test(svgRoot)) {
    issues.push('Root <svg> is missing baseProfile="tiny-ps".');
  }
  if (!/\bversion\s*=\s*["']1\.2["']/i.test(svgRoot)) {
    issues.push('Root <svg> is missing version="1.2".');
  }
  if (/<script\b/i.test(normalized)) {
    issues.push('SVG contains <script>, which is not allowed for BIMI.');
  }
  if (/\b(?:xlink:href|href)\s*=\s*["']https?:\/\//i.test(normalized)) {
    issues.push('SVG references an external HTTP(S) asset; BIMI SVG should be self-contained.');
  }

  return issues;
}

async function resolveTxtFlat(hostname: string): Promise<string[]> {
  const rows = await resolveTxt(hostname);
  return rows.map((segments) => segments.join(''));
}

async function lookupTxtRecords(
  dnsResolveTxt: (hostname: string) => Promise<string[]>,
  hostname: string,
): Promise<string[]> {
  try {
    const values = await dnsResolveTxt(hostname);
    return values.map((value) => value.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function parseBimiRecord(value: string): ParsedBimiRecord {
  const locationUrl = value.match(/(?:^|;)\s*l\s*=\s*([^;]+)/i)?.[1]?.trim() ?? null;
  return { locationUrl };
}

function validateConfig(config: EmailDomainBrandingValidationConfig): string | null {
  if (!config.domain?.trim()) return 'Missing required configuration: domain.';
  if (!config.dkimSelector?.trim()) return 'Missing required configuration: dkimSelector.';
  if (!/^[a-z0-9.-]+$/i.test(config.domain)) {
    return `Invalid domain value "${config.domain}".`;
  }
  if (!['none', 'quarantine', 'reject'].includes(config.expectedDmarcPolicy)) {
    return 'expectedDmarcPolicy must be one of: none, quarantine, reject.';
  }
  if (config.expectedBimiLogoUrl && !/^https?:\/\//i.test(config.expectedBimiLogoUrl)) {
    return `expectedBimiLogoUrl must be absolute (http/https), got "${config.expectedBimiLogoUrl}".`;
  }
  return null;
}

function pushPass(
  checks: EmailDomainBrandingValidationCheck[],
  id: EmailDomainBrandingValidationCheck['id'],
  message: string,
): void {
  checks.push({ id, status: 'pass', message });
}

function pushFail(
  checks: EmailDomainBrandingValidationCheck[],
  errors: string[],
  id: EmailDomainBrandingValidationCheck['id'],
  message: string,
): void {
  checks.push({ id, status: 'fail', message });
  errors.push(message);
}

function pushWarn(
  checks: EmailDomainBrandingValidationCheck[],
  warnings: string[],
  id: EmailDomainBrandingValidationCheck['id'],
  message: string,
): void {
  checks.push({ id, status: 'warn', message });
  warnings.push(message);
}

function pushSkip(
  checks: EmailDomainBrandingValidationCheck[],
  id: EmailDomainBrandingValidationCheck['id'],
  message: string,
): void {
  checks.push({ id, status: 'skip', message });
}
