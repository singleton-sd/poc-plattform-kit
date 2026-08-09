// End-to-end CLI integration test: exercises run() the same way the
// preview Docker build and CI invoke it — a generated SQLite client
// directory path plus an explicit database URL — to catch issues (like
// ESM directory-import resolution) that unit tests on the helpers alone
// would miss.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, test } from 'node:test';
import { transformToSqlitePreviewSchema } from './generate-preview-schema.mjs';
import { run } from './seed.mjs';

const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url));
const CANONICAL_SCHEMA_PATH = join(PACKAGE_ROOT, 'prisma', 'schema.prisma');

let workDir;
let dbPath;
let clientOutputDir;

before(() => {
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
});

after(() => {
  if (workDir) rmSync(workDir, { recursive: true, force: true });
});

test(
  'run() seeds "demo" via a directory client path and database-url flag',
  { timeout: 60_000 },
  async () => {
    await run([`--scenarios=demo`, `--database-url=file:${dbPath}`, `--client=${clientOutputDir}`]);
  },
);

test(
  'run() defaults to "demo" via PREVIEW_SEED_SCENARIOS when --scenarios is omitted',
  { timeout: 60_000 },
  async () => {
    await run([`--database-url=file:${dbPath}`, `--client=${clientOutputDir}`], {
      env: { PREVIEW_SEED_SCENARIOS: 'pillar/tenant/owner' },
    });
  },
);

test(
  '--verify-only re-checks already-seeded fixtures without seeding again',
  { timeout: 60_000 },
  async () => {
    // Simulates the entrypoint's post-copy readiness check on container
    // start: the template was already seeded at build time, so a redeploy
    // should only verify, never re-run seed().
    await run([
      '--verify-only',
      '--scenarios=demo',
      `--database-url=file:${dbPath}`,
      `--client=${clientOutputDir}`,
    ]);
  },
);
