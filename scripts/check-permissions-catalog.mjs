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
const API_MANIFEST_REL = 'apps/api/src/permissions/permissions.manifest.json';
const MODEL_FGA_REL = 'infra/openfga/model.fga';
const MODEL_JSON_REL = 'infra/openfga/model.json';
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
    if (row.resourceObjectId != null && typeof row.resourceObjectId !== 'string') {
      throw new Error(`${label}: resourceObjectId must be a string when set`);
    }
    const hasParam = typeof row.resourceIdParam === 'string' && row.resourceIdParam.trim();
    const hasObjectId = typeof row.resourceObjectId === 'string' && row.resourceObjectId.trim();
    if (!hasParam && !hasObjectId) {
      throw new Error(`${label}: set resourceIdParam or resourceObjectId`);
    }
    if (hasParam && !String(row.path).includes(`:${row.resourceIdParam}`)) {
      throw new Error(`${label}: path "${row.path}" does not include :${row.resourceIdParam}`);
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
 * @param {string} sourceLabel
 */
export function assertManifestMatchesModel(manifest, modelRelations, sourceLabel = MODEL_FGA_REL) {
  const errors = [];
  for (const entry of manifest.entries) {
    const relations = modelRelations.get(entry.resourceType);
    if (!relations) {
      errors.push(
        `manifest entry "${entry.id}": resourceType "${entry.resourceType}" is not a type in ${sourceLabel}`,
      );
      continue;
    }
    if (!relations.has(entry.action)) {
      errors.push(
        `manifest entry "${entry.id}": action "${entry.action}" is not defined on type "${entry.resourceType}" in ${sourceLabel}`,
      );
    }
  }
  if (errors.length) {
    throw new Error(errors.join('\n'));
  }
}

/**
 * Parse committed model.json type_definitions → relation names.
 * @param {object} modelJson
 * @returns {Map<string, Set<string>>}
 */
export function parseModelJsonRelations(modelJson) {
  /** @type {Map<string, Set<string>>} */
  const types = new Map();
  for (const typeDef of modelJson?.type_definitions ?? []) {
    if (!typeDef?.type || typeof typeDef.relations !== 'object' || !typeDef.relations) {
      continue;
    }
    types.set(typeDef.type, new Set(Object.keys(typeDef.relations)));
  }
  return types;
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
  if (!routeModuleSource.includes('permissions.manifest.json')) {
    throw new Error(
      `${ROUTE_MODULE_REL}: must resolve a permissions.manifest.json beside the Nest module for ACA images`,
    );
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
 * Infra + Nest copies of the manifest must stay identical (register updates both).
 * @param {string} infraRaw
 * @param {string} apiRaw
 */
export function assertManifestCopiesInSync(infraRaw, apiRaw) {
  const infra = JSON.stringify(JSON.parse(infraRaw));
  const api = JSON.stringify(JSON.parse(apiRaw));
  if (infra !== api) {
    throw new Error(
      `${MANIFEST_REL} and ${API_MANIFEST_REL} diverge — keep them identical so Nest/ACA ships the same catalog`,
    );
  }
}

/**
 * @param {string} [root]
 */
export function checkPermissionsCatalog(root = ROOT) {
  const manifestPath = resolve(root, MANIFEST_REL);
  const apiManifestPath = resolve(root, API_MANIFEST_REL);
  const modelPath = resolve(root, MODEL_FGA_REL);
  const guardPath = resolve(root, GUARD_REL);
  const routeModulePath = resolve(root, ROUTE_MODULE_REL);

  const infraRaw = readFileSync(manifestPath, 'utf8');
  const apiRaw = readFileSync(apiManifestPath, 'utf8');
  assertManifestCopiesInSync(infraRaw, apiRaw);

  const manifest = validateManifestShape(JSON.parse(infraRaw));
  const modelRelations = parseModelFgaRelations(readFileSync(modelPath, 'utf8'));
  assertManifestMatchesModel(manifest, modelRelations, MODEL_FGA_REL);
  const modelJson = JSON.parse(readFileSync(resolve(root, MODEL_JSON_REL), 'utf8'));
  assertManifestMatchesModel(manifest, parseModelJsonRelations(modelJson), MODEL_JSON_REL);
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
