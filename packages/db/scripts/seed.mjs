#!/usr/bin/env node
// CLI entry point for seeding preview scenarios. Used by:
//   - the preview Docker build (build-time seeding of the immutable template)
//   - CI (validates that declared scenarios exist and seed successfully)
//   - local development (seed a scratch SQLite database while building a
//     new scenario)
//
// Usage:
//   node scripts/seed.mjs --list
//   node scripts/seed.mjs --scenarios=demo --database-url=file:./prisma/preview.db --client=./prisma/generated/preview-client
//   PREVIEW_SEED_SCENARIOS=pillar/tenant/owner node scripts/seed.mjs --database-url=... --client=...
//
// Reads PREVIEW_SEED_SCENARIOS when --scenarios is not passed, defaulting
// to "demo" when neither is set.

import { statSync } from 'node:fs';
import { join, resolve as resolvePath } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createCatalog, DEFAULT_SCENARIOS } from './scenarios/catalog.mjs';
import { seedResolvedScenarios, verifyResolvedScenarios } from './scenarios/seed-runner.mjs';

export function parseArgs(argv) {
  const args = {
    scenarios: undefined,
    client: '@prisma/client',
    databaseUrl: undefined,
    list: false,
    verify: true,
    verifyOnly: false,
  };
  for (const arg of argv) {
    if (arg === '--list') args.list = true;
    else if (arg === '--no-verify') args.verify = false;
    else if (arg === '--verify-only') args.verifyOnly = true;
    else if (arg.startsWith('--scenarios=')) args.scenarios = arg.slice('--scenarios='.length);
    else if (arg.startsWith('--client=')) args.client = arg.slice('--client='.length);
    else if (arg.startsWith('--database-url='))
      args.databaseUrl = arg.slice('--database-url='.length);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (args.verifyOnly && !args.verify) {
    throw new Error('--verify-only and --no-verify are mutually exclusive');
  }
  return args;
}

export function parseScenarioNames(raw) {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function resolveClientSpecifier(client) {
  if (!client.startsWith('.') && !client.startsWith('/')) {
    return client; // bare specifier (e.g. "@prisma/client") — let Node's resolver handle it
  }
  // A generated Prisma client's package.json declares "exports", but that
  // only applies to bare-specifier resolution — a file:// URL pointing at
  // the directory bypasses it, so resolve the entry file explicitly.
  let resolved = resolvePath(process.cwd(), client);
  if (statSync(resolved).isDirectory()) {
    resolved = join(resolved, 'index.js');
  }
  return pathToFileURL(resolved).href;
}

export async function run(argv, { env = process.env } = {}) {
  const args = parseArgs(argv);
  const catalog = createCatalog();

  if (args.list) {
    const scenarios = catalog.list().map((s) => ({
      name: s.name,
      description: s.description,
      dependsOn: s.dependsOn,
      testInstructions: s.testInstructions,
    }));
    console.log(JSON.stringify(scenarios, null, 2));
    return;
  }

  const requestedRaw = args.scenarios ?? env.PREVIEW_SEED_SCENARIOS ?? DEFAULT_SCENARIOS.join(',');
  const requested = parseScenarioNames(requestedRaw);
  const resolved = catalog.resolve(requested);

  const databaseUrl = args.databaseUrl ?? env.DATABASE_URL;
  const { PrismaClient } = await import(resolveClientSpecifier(args.client));
  const prisma = new PrismaClient(
    databaseUrl ? { datasources: { db: { url: databaseUrl } } } : undefined,
  );

  try {
    if (args.verifyOnly) {
      console.log(
        `Verifying ${resolved.length} scenario(s) [requested: ${requested.join(', ')}]: ${resolved
          .map((s) => s.name)
          .join(', ')}`,
      );
    } else {
      console.log(
        `Seeding ${resolved.length} scenario(s) [requested: ${requested.join(', ')}]: ${resolved
          .map((s) => s.name)
          .join(', ')}`,
      );
      await seedResolvedScenarios(prisma, resolved);
    }

    if (args.verify) {
      const results = await verifyResolvedScenarios(prisma, resolved);
      let failed = false;
      for (const result of results) {
        console.log(`  [${result.ok ? 'OK  ' : 'FAIL'}] ${result.name} — ${result.message}`);
        if (!result.ok) failed = true;
      }
      if (failed) {
        throw new Error('One or more preview scenarios failed verification.');
      }
    }

    console.log(
      args.verifyOnly
        ? 'Preview scenario verification complete.'
        : 'Preview scenario seeding complete.',
    );
  } finally {
    await prisma.$disconnect();
  }
}

const isCliInvocation = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isCliInvocation) {
  run(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
