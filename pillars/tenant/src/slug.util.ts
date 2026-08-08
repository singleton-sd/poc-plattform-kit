export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Fallback base used when a name normalizes to nothing (e.g. non-Latin scripts). */
const FALLBACK_SLUG_BASE = 'tenant';

const DIACRITICS_PATTERN = /[\u0300-\u036f]/g;

/**
 * Normalizes a tenant name into a URL-friendly slug base: lowercase, diacritics
 * stripped, non-alphanumeric runs collapsed to a single hyphen, edges trimmed.
 * Falls back to a fixed base when nothing alphanumeric survives normalization
 * (e.g. names composed entirely of non-Latin/CJK characters).
 */
export function slugify(name: string): string {
  const normalized = name
    .normalize('NFKD')
    .replace(DIACRITICS_PATTERN, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized || FALLBACK_SLUG_BASE;
}
