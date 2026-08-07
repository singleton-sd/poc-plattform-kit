#!/usr/bin/env node
/**
 * Azure Static Web Apps rejects configs where two `routes` entries normalize
 * to the same path (e.g. `/admin` and `/admin/`). Validate before CI/deploy.
 *
 * Usage:
 *   node scripts/validate-staticwebapp-config.mjs [path...]
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * @param {string} route
 * @returns {string}
 */
export function normalizeSwaRoute(route) {
  if (route === '/') {
    return '/';
  }
  return route.replace(/\/+$/u, '') || '/';
}

/**
 * @param {Array<{ route?: unknown }> | undefined} routes
 * @returns {Array<{ route: string, conflictsWith: string, normalized: string }>}
 */
export function findDuplicateSwaRoutes(routes) {
  /** @type {Map<string, string>} */
  const seen = new Map();
  /** @type {Array<{ route: string, conflictsWith: string, normalized: string }>} */
  const duplicates = [];

  for (const entry of routes ?? []) {
    if (typeof entry?.route !== 'string' || entry.route.length === 0) {
      continue;
    }
    const normalized = normalizeSwaRoute(entry.route);
    const prior = seen.get(normalized);
    if (prior !== undefined) {
      duplicates.push({
        route: entry.route,
        conflictsWith: prior,
        normalized,
      });
      continue;
    }
    seen.set(normalized, entry.route);
  }

  return duplicates;
}

/**
 * @param {unknown} config
 * @param {string} fileLabel
 */
export function assertValidStaticWebAppConfig(config, fileLabel) {
  if (config === null || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error(`${fileLabel}: expected a JSON object`);
  }

  const routes = /** @type {{ routes?: unknown }} */ (config).routes;
  if (routes === undefined) {
    return;
  }
  if (!Array.isArray(routes)) {
    throw new Error(`${fileLabel}: "routes" must be an array when present`);
  }

  const duplicates = findDuplicateSwaRoutes(/** @type {Array<{ route?: unknown }>} */ (routes));
  if (duplicates.length === 0) {
    return;
  }

  const details = duplicates
    .map(
      (d) => `  - "${d.route}" conflicts with "${d.conflictsWith}" (normalized "${d.normalized}")`,
    )
    .join('\n');
  throw new Error(
    `${fileLabel}: Azure SWA rejects duplicate routes (trailing-slash variants count as the same):\n${details}`,
  );
}

/**
 * @param {string} filePath
 */
export function validateStaticWebAppConfigFile(filePath) {
  const absolute = resolve(filePath);
  let raw;
  try {
    raw = readFileSync(absolute, 'utf8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to read ${absolute}: ${message}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${absolute}: invalid JSON (${message})`);
  }

  assertValidStaticWebAppConfig(parsed, absolute);
}

const isDirectRun = process.argv[1]
  ? resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isDirectRun) {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(scriptDir, '..');
  const defaults = [
    resolve(repoRoot, 'apps/marketing/public/staticwebapp.config.json'),
    resolve(repoRoot, 'apps/web/public/staticwebapp.config.json'),
  ];
  const targets = process.argv.slice(2).length > 0 ? process.argv.slice(2) : defaults;

  let failed = false;
  for (const target of targets) {
    try {
      validateStaticWebAppConfigFile(target);
      console.log(`OK  ${target}`);
    } catch (error) {
      failed = true;
      console.error(error instanceof Error ? error.message : error);
    }
  }
  process.exit(failed ? 1 : 0);
}
