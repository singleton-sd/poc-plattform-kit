import { z } from 'zod';

export const tenantSettingsFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
});

export type TenantSettingsFormInput = z.infer<typeof tenantSettingsFormSchema>;

export type ParsedSettings = { settings?: Record<string, unknown> };
export type ParseSettingsError = { error: string };

/**
 * Parses the raw settings textarea into an update payload. Blank text omits
 * `settings` from the payload (leaves the tenant's current settings
 * unchanged) — the API's `@IsObject()` validation on `UpdateTenantDto`
 * rejects `null`, so there is no supported way to clear settings here.
 */
export function parseSettingsText(text: string): ParsedSettings | ParseSettingsError {
  const trimmed = text.trim();
  if (!trimmed) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { error: 'Settings must be valid JSON' };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { error: 'Settings must be a JSON object' };
  }

  return { settings: parsed as Record<string, unknown> };
}
