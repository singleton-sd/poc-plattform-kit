// Integration test: builds a real SQLite preview schema + client from the
// canonical schema, pushes it to a fresh database, and queries it — the
// "does this actually work end to end" check that unit tests on the string
// transform alone can't give us. Mirrors (at smaller scale) what the preview
// Docker image does at build time.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, test } from 'node:test';
import { transformToSqlitePreviewSchema } from './generate-preview-schema.mjs';

const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url));
const CANONICAL_SCHEMA_PATH = join(PACKAGE_ROOT, 'prisma', 'schema.prisma');

let workDir;
let schemaPath;
let dbPath;
let clientOutputDir;

before(() => {
  // Prisma infers its project root by walking up from the schema path
  // looking for a package.json; a schema under the OS tmp dir has none, so
  // the CLI falls back to a broken "auto-install" flow. Keep the scratch
  // schema inside the package (gitignored) so Prisma resolves normally.
  workDir = mkdtempSync(join(PACKAGE_ROOT, '.tmp-preview-integration-'));
  schemaPath = join(workDir, 'schema.preview.prisma');
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
});

after(() => {
  if (workDir) rmSync(workDir, { recursive: true, force: true });
});

test(
  'a freshly generated SQLite preview client can create and query every canonical model family',
  { timeout: 60_000 },
  async () => {
    const { PrismaClient } = await import(join(clientOutputDir, 'index.js'));
    const prisma = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

    try {
      const user = await prisma.user.create({
        data: { entraOid: 'oid-integration-test', email: 'integration-test@example.invalid' },
      });
      const tenant = await prisma.tenant.create({
        data: { name: 'Integration Test Co', slug: 'integration-test-co' },
      });
      await prisma.tenantMembership.create({
        data: { tenantId: tenant.id, userId: user.id, role: 'owner' },
      });
      await prisma.tenantAudit.create({
        data: {
          entityType: 'Tenant',
          entityId: tenant.id,
          action: 'created',
          changes: JSON.stringify({ name: tenant.name }),
        },
      });
      await prisma.tenantOutbox.create({
        data: { eventType: 'tenant.created', payload: JSON.stringify({ id: tenant.id }) },
      });

      const [users, tenants, memberships, audits, outboxRows] = await Promise.all([
        prisma.user.findMany(),
        prisma.tenant.findMany(),
        prisma.tenantMembership.findMany(),
        prisma.tenantAudit.findMany(),
        prisma.tenantOutbox.findMany(),
      ]);

      assert.equal(users.length, 1);
      assert.equal(tenants.length, 1);
      assert.equal(memberships.length, 1);
      assert.equal(memberships[0].role, 'owner');
      assert.equal(audits.length, 1);
      assert.equal(outboxRows.length, 1);
      assert.equal(outboxRows[0].processedAt, null);
    } finally {
      await prisma.$disconnect();
    }
  },
);
