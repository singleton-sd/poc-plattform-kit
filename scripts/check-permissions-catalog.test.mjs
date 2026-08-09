import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  assertGuardUsesManifest,
  assertManifestMatchesModel,
  checkPermissionsCatalog,
  parseModelFgaRelations,
  validateManifestShape,
} from './check-permissions-catalog.mjs';
import {
  buildEntryFromArgs,
  parseArgs,
  planModelFgaUpdate,
  registerPermission,
} from './register-permission.mjs';

const SAMPLE_FGA = `
model
  schema 1.1

type tenant
  relations
    define admin: [user]
    define update: [user] or admin

condition not_yet_expired(current_time: timestamp, expiry_time: timestamp) {
  current_time < expiry_time
}
`;

test('parseModelFgaRelations extracts type defines', () => {
  const map = parseModelFgaRelations(SAMPLE_FGA);
  assert.ok(map.get('tenant')?.has('admin'));
  assert.ok(map.get('tenant')?.has('update'));
});

test('validateManifestShape rejects duplicates', () => {
  assert.throws(
    () =>
      validateManifestShape({
        version: 1,
        entries: [
          {
            id: 'a',
            method: 'PATCH',
            path: '/tenants/:id',
            action: 'update',
            resourceType: 'tenant',
          },
          {
            id: 'a',
            method: 'GET',
            path: '/other',
            action: 'read',
            resourceType: 'tenant',
          },
        ],
      }),
    /duplicate id/,
  );
});

test('assertManifestMatchesModel fails on missing relation', () => {
  const manifest = validateManifestShape({
    version: 1,
    entries: [
      {
        id: 'x',
        method: 'PATCH',
        path: '/tenants/:id',
        action: 'delete',
        resourceType: 'tenant',
      },
    ],
  });
  assert.throws(
    () => assertManifestMatchesModel(manifest, parseModelFgaRelations(SAMPLE_FGA)),
    /delete/,
  );
});

test('assertGuardUsesManifest requires shared matcher', () => {
  assert.throws(
    () =>
      assertGuardUsesManifest(
        `private mapPermission(request) { return null; }`,
        `export const PERMISSIONS_MANIFEST_RELATIVE = 'x';`,
      ),
    /route-permissions/,
  );
  assert.doesNotThrow(() =>
    assertGuardUsesManifest(
      `import { matchRoutePermission } from './route-permissions';\nmatchRoutePermission(req);`,
      `export const PERMISSIONS_MANIFEST_RELATIVE = join('infra','openfga','permissions.manifest.json');`,
    ),
  );
});

test('checkPermissionsCatalog passes on this repo', () => {
  checkPermissionsCatalog();
});

test('registerPermission dry-run plans a new type', () => {
  const root = mkdtempSync(join(tmpdir(), 'perm-reg-'));
  try {
    mkdirSync(join(root, 'infra', 'openfga'), { recursive: true });
    writeFileSync(
      join(root, 'infra', 'openfga', 'permissions.manifest.json'),
      JSON.stringify({ version: 1, entries: [] }, null, 2),
    );
    writeFileSync(join(root, 'infra', 'openfga', 'model.fga'), SAMPLE_FGA);
    writeFileSync(
      join(root, 'infra', 'openfga', 'model.json'),
      JSON.stringify({ schema_version: '1.1', type_definitions: [] }, null, 2),
    );

    const summary = registerPermission({
      root,
      args: parseArgs([
        '--method',
        'PATCH',
        '--path',
        '/contacts/:id',
        '--action',
        'update',
        '--resourceType',
        'contact',
        '--resourceIdParam',
        'id',
      ]),
    });
    assert.equal(summary.apply, false);
    assert.match(summary.modelFga, /added type contact/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('planModelFgaUpdate is idempotent for existing relation', () => {
  const plan = planModelFgaUpdate(SAMPLE_FGA, 'tenant', 'update');
  assert.equal(plan.changed, false);
});

test('buildEntryFromArgs requires fields', () => {
  assert.throws(() => buildEntryFromArgs({ method: 'GET' }), /Required/);
});
