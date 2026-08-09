export type ParsedSettings = { settings?: Record<string, unknown> };
export type ParseSettingsError = { error: string };

/**
 * Parses the raw settings textarea into an update payload. Blank text omits
 * `settings` from the payload (leaves the tenant's current settings
 * unchanged) — the API's `@IsObject()` validation on `UpdateTenantDto`
 * rejects `null`, so there is no supported way to clear settings here.
 *
 * `settings` is an arbitrary, tenant-defined JSON object rather than a fixed
 * shape, so it doesn't fit the Zod → JSON Schema → UI Schema → JSON Forms
 * pipeline (schema-driven-forms skill) and is handled as the documented
 * hand-built escape hatch; the `name` field above it in `tenant-settings.tsx`
 * goes through that pipeline via the shared `UpdateTenantForm`.
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
