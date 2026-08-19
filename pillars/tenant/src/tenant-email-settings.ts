export type TenantEmailSettings = {
  fromAddress?: string;
  fromName?: string;
  contactInboxAddress?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function resolveTenantEmailSettings(
  tenantSettings: Record<string, unknown> | null | undefined,
): TenantEmailSettings | null {
  const settings = asRecord(tenantSettings);
  const email = asRecord(settings?.email);
  if (!email) return null;

  const fromAddress = asNonEmptyString(email.fromAddress);
  const fromName = asNonEmptyString(email.fromName);
  const contactInboxAddress = asNonEmptyString(email.contactInboxAddress);

  if (!fromAddress && !fromName && !contactInboxAddress) return null;

  return { fromAddress, fromName, contactInboxAddress };
}
