#!/usr/bin/env node
// CI gate for the preview-scenario delivery standard (AGENTS.md,
// docs/preview-scenarios.md). For a PR that touches data-affecting paths
// (apps/api/**, pillars/**, packages/db/**), requires either a valid
// `preview-scenarios` declaration or a justified `not-applicable`
// exemption, rejects unknown scenario names, and proves every declared
// scenario actually seeds and verifies successfully against a real,
// throwaway SQLite database (the same mechanism the preview Docker image
// uses).
//
// Usage:
//   node scripts/validate-preview-scenarios.mjs --changed-files=changed.txt < pr-body.txt
//   node scripts/validate-preview-scenarios.mjs --changed-files=changed.txt --body-file=pr-body.txt
//
// Exits non-zero with an actionable message on any violation.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePreviewScenarioDeclaration } from './parse-preview-scenarios.mjs';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const DB_PACKAGE_ROOT = join(REPO_ROOT, 'packages', 'db');

const DATA_AFFECTING_PREFIXES = ['apps/api/', 'pillars/', 'packages/db/'];

export function touchesDataAffectingPaths(changedFiles) {
  return changedFiles.some((file) => DATA_AFFECTING_PREFIXES.some((p) => file.startsWith(p)));
}

/**
 * Validates a declaration against a change set. Returns { ok, errors }.
 * Does not seed anything — see seedAndVerifyScenarios for that.
 */
export function validateDeclaration(declaration, changedFiles) {
  const requiresDeclaration = touchesDataAffectingPaths(changedFiles);

  if (declaration.kind === 'unset' || declaration.kind === 'empty') {
    if (requiresDeclaration) {
      return {
        ok: false,
        errors: [
          'This PR touches apps/api/**, pillars/**, or packages/db/** and must declare preview ' +
            'scenarios with a "Preview scenarios: name1, name2" line, or an explicit exemption ' +
            '("Preview scenarios: not-applicable — <reason>"). See docs/preview-scenarios.md.',
        ],
      };
    }
    return { ok: true, errors: [] };
  }

  if (declaration.kind === 'not-applicable') {
    if (declaration.reason.trim().length === 0) {
      return {
        ok: false,
        errors: ['A `not-applicable` preview-scenario exemption must include a reason.'],
      };
    }
    return { ok: true, errors: [] };
  }

  // kind === 'scenarios': existence is checked by seedAndVerifyScenarios,
  // which has the real catalog loaded.
  return { ok: true, errors: [] };
}

/**
 * Builds a fresh SQLite preview database and actually seeds + verifies the
 * declared scenarios against it — proving they exist, compose without
 * conflicts/cycles, and seed successfully, not just that the declaration is
 * well-formed.
 */
export async function seedAndVerifyDeclaredScenarios(names) {
  const { transformToSqlitePreviewSchema } = await import(
    join(DB_PACKAGE_ROOT, 'scripts', 'generate-preview-schema.mjs')
  );
  const { createCatalog } = await import(
    join(DB_PACKAGE_ROOT, 'scripts', 'scenarios', 'catalog.mjs')
  );
  const { seedResolvedScenarios, verifyResolvedScenarios } = await import(
    join(DB_PACKAGE_ROOT, 'scripts', 'scenarios', 'seed-runner.mjs')
  );

  const catalog = createCatalog();
  let resolved;
  try {
    resolved = catalog.resolve(names);
  } catch (error) {
    return { ok: false, errors: [error instanceof Error ? error.message : String(error)] };
  }

  const workDir = mkdtempSync(join(DB_PACKAGE_ROOT, '.tmp-preview-integration-'));
  try {
    const schemaPath = join(workDir, 'schema.preview.prisma');
    const dbPath = join(workDir, 'preview.db');
    const clientOutputDir = join(workDir, 'preview-client');

    const canonical = readFileSync(join(DB_PACKAGE_ROOT, 'prisma', 'schema.prisma'), 'utf8');
    const preview = transformToSqlitePreviewSchema(canonical).replace(
      /output\s*=\s*"[^"]*"/,
      `output   = "${clientOutputDir.replace(/\\/g, '\\\\')}"`,
    );
    writeFileSync(schemaPath, preview);

    const env = { ...process.env, DATABASE_URL: `file:${dbPath}` };
    const prismaBin = join(DB_PACKAGE_ROOT, 'node_modules', '.bin', 'prisma');
    execFileSync(
      prismaBin,
      ['db', 'push', `--schema=${schemaPath}`, '--skip-generate', '--accept-data-loss'],
      { cwd: DB_PACKAGE_ROOT, env, stdio: 'pipe' },
    );
    execFileSync(prismaBin, ['generate', `--schema=${schemaPath}`], {
      cwd: DB_PACKAGE_ROOT,
      env,
      stdio: 'pipe',
    });

    const { PrismaClient } = await import(join(clientOutputDir, 'index.js'));
    const prisma = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
    try {
      await seedResolvedScenarios(prisma, resolved);
      const results = await verifyResolvedScenarios(prisma, resolved);
      const failures = results.filter((r) => !r.ok);
      if (failures.length > 0) {
        return {
          ok: false,
          errors: failures.map((f) => `Scenario "${f.name}" failed verification: ${f.message}`),
        };
      }
      return { ok: true, errors: [] };
    } finally {
      await prisma.$disconnect();
    }
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

function parseArgs(argv) {
  const args = { changedFiles: undefined, bodyFile: undefined };
  for (const arg of argv) {
    if (arg.startsWith('--changed-files='))
      args.changedFiles = arg.slice('--changed-files='.length);
    else if (arg.startsWith('--body-file=')) args.bodyFile = arg.slice('--body-file='.length);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const changedFiles = args.changedFiles
    ? readFileSync(args.changedFiles, 'utf8')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
    : [];
  const body = args.bodyFile ? readFileSync(args.bodyFile, 'utf8') : readFileSync(0, 'utf8');

  const declaration = parsePreviewScenarioDeclaration(body);
  const declResult = validateDeclaration(declaration, changedFiles);
  if (!declResult.ok) {
    for (const error of declResult.errors) console.error(`::error::${error}`);
    process.exitCode = 1;
    return;
  }

  if (declaration.kind === 'scenarios') {
    const seedResult = await seedAndVerifyDeclaredScenarios(declaration.names);
    if (!seedResult.ok) {
      for (const error of seedResult.errors) console.error(`::error::${error}`);
      process.exitCode = 1;
      return;
    }
    console.log(`Preview scenarios OK: ${declaration.names.join(', ')}`);
    return;
  }

  if (declaration.kind === 'not-applicable') {
    console.log(`Preview scenario exemption OK: ${declaration.reason}`);
    return;
  }

  console.log('No preview scenario declaration required for this change set.');
}

const isCliInvocation = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isCliInvocation) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
