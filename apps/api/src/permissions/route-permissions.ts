import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export interface RoutePermissionEntry {
  id: string;
  method: string;
  path: string;
  action: string;
  resourceType: string;
  resourceIdParam?: string;
  notes?: string;
}

export interface PermissionsManifest {
  version: number;
  entries: RoutePermissionEntry[];
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

export function findRepoRoot(startDir: string = process.cwd()): string {
  let dir = startDir;
  for (;;) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(`Could not find repo root (pnpm-workspace.yaml) walking up from ${startDir}`);
    }
    dir = parent;
  }
}

/**
 * Prefer the Nest-bundled copy next to this module (works in ACA `/app` images).
 * Fall back to repo-root paths for local scripts / monorepo cwd layouts.
 */
export function resolvePermissionsManifestPath(repoRoot?: string): string {
  const besideModule = join(__dirname, 'permissions.manifest.json');
  if (existsSync(besideModule)) {
    return besideModule;
  }

  const root = repoRoot ?? findRepoRoot();
  const apiCopy = join(root, API_PERMISSIONS_MANIFEST_RELATIVE);
  if (existsSync(apiCopy)) {
    return apiCopy;
  }
  return join(root, PERMISSIONS_MANIFEST_RELATIVE);
}

export function loadPermissionsManifest(repoRoot?: string): PermissionsManifest {
  const path = resolvePermissionsManifestPath(repoRoot);
  const raw = JSON.parse(readFileSync(path, 'utf8')) as PermissionsManifest;
  if (!raw || !Array.isArray(raw.entries)) {
    throw new Error(`${path}: missing entries array`);
  }
  return raw;
}

export function getRoutePermissionEntries(repoRoot?: string): RoutePermissionEntry[] {
  if (!repoRoot && cachedEntries) {
    return cachedEntries;
  }
  const entries = loadPermissionsManifest(repoRoot).entries;
  if (!repoRoot) {
    cachedEntries = entries;
  }
  return entries;
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
      return null;
    }
    return {
      action: entry.action,
      resource: `${entry.resourceType}:${id}`,
    };
  }

  return {
    action: entry.action,
    resource: entry.resourceType,
  };
}
