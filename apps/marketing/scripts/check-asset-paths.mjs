#!/usr/bin/env node
/**
 * Assert built HTML asset/href paths honour Astro `base` (root or a GitHub
 * Pages PR preview subpath).
 *
 * Usage:
 *   node scripts/check-asset-paths.mjs [--dir dist] [--base /]
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeBase } from '../src/lib/with-base.mjs';

const ATTR_RE = /\b(?:src|href)=["']([^"']+)["']/giu;

/**
 * @param {string} dir
 * @returns {string[]}
 */
export function collectHtmlFiles(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectHtmlFiles(full));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.html')) {
      out.push(full);
    }
  }
  return out;
}

/**
 * @param {string} value
 * @returns {boolean}
 */
function isExternalOrSpecial(value) {
  return (
    /^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(value) ||
    /^(?:mailto|tel|data):/i.test(value) ||
    value.startsWith('#') ||
    value.startsWith('javascript:')
  );
}

/**
 * Site-relative URLs that must be prefixed with Astro `base`. Relative
 * `./` / `../` URLs are left to the browser and are not checked here.
 *
 * @param {string} value
 * @param {string} base
 * @returns {string | null} error message, or null when ok
 */
export function checkPrefixedPath(value, base) {
  if (isExternalOrSpecial(value) || !value.startsWith('/')) {
    return null;
  }
  // Decap /admin is a static SPA copied from public/. It always uses
  // production-absolute /admin/ URLs; previews do not rewrite it.
  if (value === '/admin' || value.startsWith('/admin/')) {
    return null;
  }
  const normalized = normalizeBase(base);
  if (normalized === '/') {
    if (value.startsWith('/pr-preview/')) {
      return `production build must not use a preview subpath: ${value}`;
    }
    return null;
  }
  if (!value.startsWith(normalized) && value !== normalized.slice(0, -1)) {
    return `expected prefix "${normalized}" but found ${value}`;
  }
  return null;
}

/**
 * @param {string} html
 * @param {string} base
 * @param {string} fileLabel
 * @returns {string[]}
 */
export function findAssetPathErrors(html, base, fileLabel) {
  /** @type {string[]} */
  const errors = [];
  for (const match of html.matchAll(ATTR_RE)) {
    const value = match[1];
    if (!value) continue;
    const problem = checkPrefixedPath(value, base);
    if (problem) {
      errors.push(`${fileLabel}: ${problem}`);
    }
  }
  return errors;
}

/**
 * @param {{ dir: string, base: string }} options
 * @returns {string[]}
 */
export function checkBuiltAssetPaths({ dir, base }) {
  const htmlFiles = collectHtmlFiles(dir);
  if (htmlFiles.length === 0) {
    return [`No HTML files under ${dir}`];
  }
  /** @type {string[]} */
  const errors = [];
  let sawAstroAsset = false;
  const normalized = normalizeBase(base);

  for (const file of htmlFiles) {
    const html = readFileSync(file, 'utf8');
    const label = relative(dir, file).replaceAll('\\', '/');
    errors.push(...findAssetPathErrors(html, base, label));
    const expectedAstro = normalized === '/' ? '/_astro/' : `${normalized}_astro/`;
    if (html.includes(expectedAstro)) {
      sawAstroAsset = true;
    }
    if (normalized !== '/' && html.includes('src="/_astro/')) {
      errors.push(`${label}: bundled script still points at /_astro/ (missing preview base)`);
    }
    if (normalized !== '/' && html.includes('href="/_astro/')) {
      errors.push(`${label}: bundled stylesheet still points at /_astro/ (missing preview base)`);
    }
  }

  if (!sawAstroAsset) {
    errors.push(
      `No Astro bundled assets (${normalized === '/' ? '/_astro/' : `${normalized}_astro/`}) found in HTML`,
    );
  }

  return errors;
}

const isDirectRun = process.argv[1]
  ? resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isDirectRun) {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const marketingRoot = resolve(scriptDir, '..');
  /** @type {string} */
  let dir = resolve(marketingRoot, 'dist');
  /** @type {string} */
  let base = process.env.PREVIEW_BASE_PATH || '/';

  for (let i = 2; i < process.argv.length; i += 1) {
    const arg = process.argv[i];
    const next = process.argv[i + 1];
    if (arg === '--dir' && next) {
      dir = resolve(next);
      i += 1;
    } else if (arg === '--base' && next) {
      base = next;
      i += 1;
    }
  }

  try {
    statSync(dir);
  } catch {
    console.error(`Build output not found: ${dir}`);
    process.exit(1);
  }

  const errors = checkBuiltAssetPaths({ dir, base });
  if (errors.length > 0) {
    console.error(`Asset path check failed for base "${normalizeBase(base)}":`);
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }
  console.log(`OK  asset paths under ${dir} honour base ${normalizeBase(base)}`);
}
