// Integration test: seeds the real scenario catalog against a fresh SQLite
// database (same mechanism as the preview Docker image) and checks the
// properties the initiative requires: scenarios seed successfully,
// re-seeding is idempotent (no duplicates), and tenants stay isolated from
// each other.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, test } from 'node:test';
import { transformToSqlitePreviewSchema } from '../generate-preview-schema.mjs';
import { createCatalog } from './catalog.mjs';
import { seedResolvedScenarios, verifyResolvedScenarios } from './seed-runner.mjs';

const PACKAGE_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const CANONICAL_SCHEMA_PATH = join(PACKAGE_ROOT, 'prisma', 'schema.prisma');

let workDir;
let dbPath;
let clientOutputDir;
let prisma;

before(async () => {
  workDir = mkdtempSync(join(PACKAGE_ROOT, '.tmp-preview-integration-'));
  const schemaPath = join(workDir, 'schema.preview.prisma');
  dbPath = join(workDir, 'preview.db');
  clientOutputDir = join(workDir, 'preview-client');

  const canonical = readFileSync(CANONICAL_SCHEMA_PATH, 'utf8');
  const preview = transformToSqlitePreviewSchema(canonical).replace(
    /output\s*=\s*"[^"]*"/,
    `output   = "${clientOutputDir.replace(/\\/g, '\\\\')}"`,
  );
  writeFileSync(schemaPath, preview);

  const env = { ...process.env, DATABASE_URL: `file:${dbPath}` };
  const prismaBin = join(PACKAGE_ROOT, 'node_modules', '.bin', 'prisma');
  execFileSync(
    prismaBin,
    ['db', 'push', `--schema=${schemaPath}`, '--skip-generate', '--accept-data-loss'],
    { cwd: PACKAGE_ROOT, env, stdio: 'pipe' },
  );
  execFileSync(prismaBin, ['generate', `--schema=${schemaPath}`], {
    cwd: PACKAGE_ROOT,
    env,
    stdio: 'pipe',
  });

  const { PrismaClient } = await import(join(clientOutputDir, 'index.js'));
  prisma = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
});

after(async () => {
  await prisma?.$disconnect();
  if (workDir) rmSync(workDir, { recursive: true, force: true });
});

test('seeding "demo" succeeds and every scenario verifies ok', { timeout: 60_000 }, async () => {
  const catalog = createCatalog();
  const resolved = catalog.resolve(['demo']);

  await seedResolvedScenarios(prisma, resolved);
  const results = await verifyResolvedScenarios(prisma, resolved);

  const failures = results.filter((r) => !r.ok);
  assert.deepEqual(failures, [], `unexpected verification failures: ${JSON.stringify(failures)}`);
});

test('seeding "demo" twice is idempotent — no duplicate rows', { timeout: 60_000 }, async () => {
  const catalog = createCatalog();
  const resolved = catalog.resolve(['demo']);

  const countsBefore = await Promise.all([
    prisma.tenant.count(),
    prisma.tenantMembership.count(),
    prisma.tenantAudit.count(),
    prisma.tenantOutbox.count(),
  ]);

  await seedResolvedScenarios(prisma, resolved);

  const countsAfter = await Promise.all([
    prisma.tenant.count(),
    prisma.tenantMembership.count(),
    prisma.tenantAudit.count(),
    prisma.tenantOutbox.count(),
  ]);

  assert.deepEqual(countsAfter, countsBefore);
});

test('tenant scenarios stay isolated from each other', async () => {
  const emptyTenant = await prisma.tenant.findUnique({ where: { id: 'seed-tenant-empty-co' } });
  const acmeTenant = await prisma.tenant.findUnique({
    where: { id: 'seed-tenant-acme-rocketry' },
  });
  assert.ok(emptyTenant && acmeTenant);
  assert.notEqual(emptyTenant.id, acmeTenant.id);

  const emptyMemberships = await prisma.tenantMembership.count({
    where: { tenantId: emptyTenant.id },
  });
  const acmeMemberships = await prisma.tenantMembership.count({
    where: { tenantId: acmeTenant.id },
  });
  assert.equal(emptyMemberships, 0);
  assert.equal(acmeMemberships, 3);
});

test(
  'a non-tenant pillar outbox-safe scenario composes independently of demo',
  { timeout: 60_000 },
  async () => {
    const catalog = createCatalog();
    const resolved = catalog.resolve(['pillar/single-sign-on/outbox-safe']);

    await seedResolvedScenarios(prisma, resolved);
    const results = await verifyResolvedScenarios(prisma, resolved);
    assert.ok(results.every((r) => r.ok));

    const rows = await prisma.singleSignOnOutbox.findMany();
    assert.equal(rows.length, 2);
    assert.ok(rows.every((r) => JSON.parse(r.payload).synthetic === true));
  },
);
