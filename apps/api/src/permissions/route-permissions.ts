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

export const PERMISSIONS_MANIFEST_RELATIVE = join('infra', 'openfga', 'permissions.manifest.json');

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

export function loadPermissionsManifest(repoRoot?: string): PermissionsManifest {
  const root = repoRoot ?? findRepoRoot();
  const path = join(root, PERMISSIONS_MANIFEST_RELATIVE);
  const raw = JSON.parse(readFileSync(path, 'utf8')) as PermissionsManifest;
  if (!raw || !Array.isArray(raw.entries)) {
    throw new Error(`${PERMISSIONS_MANIFEST_RELATIVE}: missing entries array`);
  }
  return raw;
}

export function matchRoutePermission(
  request: {
    method?: string;
    route?: { path?: string };
    params?: Record<string, string | undefined>;
  },
  entries?: RoutePermissionEntry[],
): { action: string; resource: string } | null {
  const list = entries ?? loadPermissionsManifest().entries;
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
