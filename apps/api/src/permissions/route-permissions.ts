import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface RoutePermissionEntry {
  id: string;
  method: string;
  path: string;
  action: string;
  resourceType: string;
  /** Nest `params` key; required unless `resourceObjectId` is set. */
  resourceIdParam?: string;
  /** Literal OpenFGA object id when the route has no path param (e.g. singleton). */
  resourceObjectId?: string;
  notes?: string;
}

export interface PermissionsManifest {
  version: number;
  entries: RoutePermissionEntry[];
}

export class PermissionMappingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermissionMappingError';
  }
}

/** Canonical catalog (CI / register). Runtime Nest copy lives beside this module. */
export const PERMISSIONS_MANIFEST_RELATIVE = join('infra', 'openfga', 'permissions.manifest.json');

export const API_PERMISSIONS_MANIFEST_RELATIVE = join(
  'apps',
  'api',
  'src',
  'permissions',
  'permissions.manifest.json',
);

let cachedEntries: RoutePermissionEntry[] | null = null;

/**
 * Prefer the Nest-bundled copy next to this module (works in ACA `/app` images).
 * Never walks for a monorepo root — that breaks Docker/App Service layouts.
 */
export function resolvePermissionsManifestPath(): string {
  const besideModule = join(__dirname, 'permissions.manifest.json');
  if (existsSync(besideModule)) {
    return besideModule;
  }
  throw new PermissionMappingError(
    `permissions.manifest.json missing beside ${__dirname} (Nest asset copy / image packaging)`,
  );
}

export function loadPermissionsManifest(): PermissionsManifest {
  const path = resolvePermissionsManifestPath();
  const raw = JSON.parse(readFileSync(path, 'utf8')) as PermissionsManifest;
  if (!raw || !Array.isArray(raw.entries)) {
    throw new PermissionMappingError(`${path}: missing entries array`);
  }
  return raw;
}

export function getRoutePermissionEntries(): RoutePermissionEntry[] {
  if (cachedEntries) {
    return cachedEntries;
  }
  cachedEntries = loadPermissionsManifest().entries;
  return cachedEntries;
}

/** Test helper — clear the process-local cache. */
export function clearRoutePermissionCache(): void {
  cachedEntries = null;
}

export function matchRoutePermission(
  request: {
    method?: string;
    route?: { path?: string };
    params?: Record<string, string | undefined>;
  },
  entries?: RoutePermissionEntry[],
): { action: string; resource: string } | null {
  const list = entries ?? getRoutePermissionEntries();
  const method = (request.method ?? '').toUpperCase();
  const path = request.route?.path;
  if (!method || !path) {
    return null;
  }

  const entry = list.find(
    (candidate) => candidate.method.toUpperCase() === method && candidate.path === path,
  );
  if (!entry) {
    return null;
  }

  if (entry.resourceIdParam) {
    const id = request.params?.[entry.resourceIdParam];
    if (!id) {
      throw new PermissionMappingError(
        `Permission "${entry.id}" requires params.${entry.resourceIdParam} for ${method} ${path}`,
      );
    }
    return {
      action: entry.action,
      resource: `${entry.resourceType}:${id}`,
    };
  }

  if (entry.resourceObjectId) {
    return {
      action: entry.action,
      resource: `${entry.resourceType}:${entry.resourceObjectId}`,
    };
  }

  throw new PermissionMappingError(
    `Permission "${entry.id}" must set resourceIdParam or resourceObjectId`,
  );
}
