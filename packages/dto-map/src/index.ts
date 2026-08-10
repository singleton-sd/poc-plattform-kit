/**
 * Shared DTO wire helpers for Nest response mapping.
 *
 * Convention (pillars / apps/api):
 * - Keep domain/service records with `Date` (and other storage shapes).
 * - Put HTTP response shaping in a colocated `*.mapper.ts` (not inline in the controller).
 * - Use these helpers for ISO-8601 / null so OpenAPI + Orval stay consistent.
 *
 * Future: when nested graphs, multi-shape views, or rename-heavy versioning make
 * hand mappers painful, adopt a mapper library (e.g. AutoMapper / similar) behind
 * the same `*.mapper.ts` boundary — see docs/dto-mapping.md and ClickUp follow-up.
 */

/** Nullable Date → ISO-8601 string or null (OpenAPI `string | null`). */
export function toIsoString(value: Date | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  return value.toISOString();
}

/** Required Date → ISO-8601 string (throws if missing — programmer error). */
export function toIsoStringRequired(value: Date): string {
  return value.toISOString();
}
