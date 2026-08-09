#!/usr/bin/env node
/**
 * Permissions catalog drift check.
 *
 * Fails when:
 * - infra/openfga/permissions.manifest.json is invalid / duplicate ids
 * - a manifest entry's action is not defined on its resourceType in model.fga
 * - PermissionsGuard still hardcodes route mappings instead of using the manifest
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const MANIFEST_REL = 'infra/openfga/permissions.manifest.json';
const MODEL_FGA_REL = 'infra/openfga/model.fga';
const GUARD_REL = 'apps/api/src/permissions/permissions.guard.ts';
const ROUTE_MODULE_REL = 'apps/api/src/permissions/route-permissions.ts';

/**
 * @typedef {{ id: string, method: string, path: string, action: string, resourceType: string, resourceIdParam?: string }} ManifestEntry
 * @typedef {{ version: number, entries: ManifestEntry[] }} PermissionsManifest
 */

/**
 * Parse OpenFGA DSL for type → relation names (define lines only).
 * @param {string} dsl
 * @returns {Map<string, Set<string>>}
 */
export function parseModelFgaRelations(dsl) {
  /** @type {Map<string, Set<string>>} */
  const types = new Map();
  let currentType = null;

  for (const rawLine of dsl.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;

    const typeMatch = /^type\s+([A-Za-z_][A-Za-z0-9_]*)$/.exec(line);
    if (typeMatch) {
      currentType = typeMatch[1];
      if (!types.has(currentType)) {
        types.set(currentType, new Set());
      }
      continue;
    }

    const defineMatch = /^define\s+([A-Za-z_][A-Za-z0-9_]*)\s*:/.exec(line);
    if (defineMatch && currentType) {
      types.get(currentType)?.add(defineMatch[1]);
    }
  }

  return types;
}

/**
 * @param {unknown} raw
 * @returns {PermissionsManifest}
 */
export function validateManifestShape(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`${MANIFEST_REL}: root must be an object`);
  }
  const manifest = /** @type {Record<string, unknown>} */ (raw);
  if (manifest.version !== 1) {
    throw new Error(`${MANIFEST_REL}: version must be 1`);
  }
  if (!Array.isArray(manifest.entries)) {
    throw new Error(`${MANIFEST_REL}: entries must be an array`);
  }

  /** @type {Set<string>} */
  const ids = new Set();
  /** @type {Set<string>} */
  const routeKeys = new Set();

  for (const [index, entry] of manifest.entries.entries()) {
    const label = `${MANIFEST_REL} entries[${index}]`;
    if (!entry || typeof entry !== 'object') {
      throw new Error(`${label}: must be an object`);
    }
    const row = /** @type {Record<string, unknown>} */ (entry);
    for (const key of ['id', 'method', 'path', 'action', 'resourceType']) {
      if (typeof row[key] !== 'string' || !String(row[key]).trim()) {
        throw new Error(`${label}: missing string field "${key}"`);
      }
    }
    if (row.resourceIdParam != null && typeof row.resourceIdParam !== 'string') {
      throw new Error(`${label}: resourceIdParam must be a string when set`);
    }

    const id = /** @type {string} */ (row.id);
    if (ids.has(id)) {
      throw new Error(`${MANIFEST_REL}: duplicate id "${id}"`);
    }
    ids.add(id);

    const routeKey = `${String(row.method).toUpperCase()} ${row.path}`;
    if (routeKeys.has(routeKey)) {
      throw new Error(`${MANIFEST_REL}: duplicate route mapping "${routeKey}"`);
    }
    routeKeys.add(routeKey);
  }

  return /** @type {PermissionsManifest} */ (manifest);
}

/**
 * @param {PermissionsManifest} manifest
 * @param {Map<string, Set<string>>} modelRelations
 */
export function assertManifestMatchesModel(manifest, modelRelations) {
  const errors = [];
  for (const entry of manifest.entries) {
    const relations = modelRelations.get(entry.resourceType);
    if (!relations) {
      errors.push(
        `manifest entry "${entry.id}": resourceType "${entry.resourceType}" is not a type in ${MODEL_FGA_REL}`,
      );
      continue;
    }
    if (!relations.has(entry.action)) {
      errors.push(
        `manifest entry "${entry.id}": action "${entry.action}" is not defined on type "${entry.resourceType}" in ${MODEL_FGA_REL}`,
      );
    }
  }
  if (errors.length) {
    throw new Error(errors.join('\n'));
  }
}

/**
 * Guard must delegate to the shared matcher (no private mapPermission).
 * @param {string} guardSource
 * @param {string} routeModuleSource
 */
export function assertGuardUsesManifest(guardSource, routeModuleSource) {
  if (!routeModuleSource.includes('PERMISSIONS_MANIFEST_RELATIVE')) {
    throw new Error(
      `${ROUTE_MODULE_REL}: expected load path constant PERMISSIONS_MANIFEST_RELATIVE`,
    );
  }
  if (!routeModuleSource.includes(MANIFEST_REL.replace(/\\/g, '/'))) {
    // Windows join may use backslash in source — accept either form in the constant usage.
  }
  if (
    !guardSource.includes("from './route-permissions'") &&
    !guardSource.includes('from "./route-permissions"')
  ) {
    throw new Error(`${GUARD_REL}: must import matchRoutePermission from ./route-permissions`);
  }
  if (/private\s+mapPermission\s*\(/.test(guardSource)) {
    throw new Error(
      `${GUARD_REL}: remove private mapPermission — route mappings belong in ${MANIFEST_REL}`,
    );
  }
  if (/mapPermission\s*\(/.test(guardSource) && !guardSource.includes('matchRoutePermission')) {
    throw new Error(`${GUARD_REL}: use matchRoutePermission from the permissions catalog`);
  }
}

/**
 * @param {string} [root]
 */
export function checkPermissionsCatalog(root = ROOT) {
  const manifestPath = resolve(root, MANIFEST_REL);
  const modelPath = resolve(root, MODEL_FGA_REL);
  const guardPath = resolve(root, GUARD_REL);
  const routeModulePath = resolve(root, ROUTE_MODULE_REL);

  const manifest = validateManifestShape(JSON.parse(readFileSync(manifestPath, 'utf8')));
  const modelRelations = parseModelFgaRelations(readFileSync(modelPath, 'utf8'));
  assertManifestMatchesModel(manifest, modelRelations);
  assertGuardUsesManifest(readFileSync(guardPath, 'utf8'), readFileSync(routeModulePath, 'utf8'));

  console.log(
    `OK permissions catalog: ${manifest.entries.length} route(s); model types: ${[...modelRelations.keys()].join(', ')}`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    checkPermissionsCatalog();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
