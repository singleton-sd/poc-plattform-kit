#!/usr/bin/env node
/**
 * Path-filtered pre-push gate aligned with ci-api.yml / ci-web.yml.
 *
 * Runs lint, test, and build for affected CI suites before `git push`.
 * Skip with SKIP_PREPUSH=1 (emergencies only) or git push --no-verify.
 *
 * Usage:
 *   node scripts/pre-push-checks.mjs
 *   node scripts/pre-push-checks.mjs --files apps/api/src/main.ts,packages/email/src/index.ts
 *   node scripts/pre-push-checks.mjs --dry-run --files pillars/tenant/src/foo.ts
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expectedChecks } from './pr-handoff-gate.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ZERO_SHA = '0'.repeat(40);

export function normalizePath(filePath) {
  return String(filePath).replaceAll('\\', '/').trim();
}

export function buildCheckPlan(changedFiles) {
  const paths = (changedFiles ?? []).map(normalizePath).filter(Boolean);
  const expected = expectedChecks(paths);
  return {
    paths,
    api: expected.includes('Lint / test / build (api)'),
    web: expected.includes('Lint / format / build (web)'),
  };
}

export function parsePrePushLine(line) {
  const parts = line.trim().split(/\s+/);
  if (parts.length < 4) {
    return null;
  }
  const [localRef, localSha, remoteRef, remoteSha] = parts;
  return { localRef, localSha, remoteRef, remoteSha };
}

export function resolveDiffRange(localSha, remoteSha, runGit) {
  if (remoteSha && remoteSha !== ZERO_SHA) {
    return `${remoteSha}..${localSha}`;
  }

  let base = 'origin/main';
  const originMain = runGit(['rev-parse', '--verify', 'origin/main'], { allowFailure: true });
  if (!originMain) {
    base = runGit(['rev-parse', '--verify', 'main']);
  }
  const mergeBase = runGit(['merge-base', base, localSha]);
  return `${mergeBase}..${localSha}`;
}

export function changedFilesForPushRef(ref, runGit) {
  if (!ref.localRef.startsWith('refs/heads/')) {
    return [];
  }
  const range = resolveDiffRange(ref.localSha, ref.remoteSha, runGit);
  const output = runGit(['diff', '--name-only', range], { allowFailure: true });
  if (!output) {
    return [];
  }
  return output.split(/\r?\n/).map(normalizePath).filter(Boolean);
}

export function collectChangedFilesFromStdin(stdinText, runGit) {
  const lines = stdinText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const files = new Set();
  for (const line of lines) {
    const ref = parsePrePushLine(line);
    if (!ref) {
      continue;
    }
    for (const file of changedFilesForPushRef(ref, runGit)) {
      files.add(file);
    }
  }
  return [...files];
}

export function createGitRunner(cwd = repoRoot) {
  return (args, options = {}) => {
    const result = spawnSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (result.status !== 0 && !options.allowFailure) {
      const detail = (result.stderr || result.stdout || '').trim();
      throw new Error(`git ${args.join(' ')} failed${detail ? `: ${detail}` : ''}`);
    }
    if (result.status !== 0) {
      return '';
    }
    return result.stdout.trim();
  };
}

export function createCommandRunner(cwd = repoRoot) {
  return (command, label) => {
    console.log(`\npre-push ▶ ${label}`);
    const result = spawnSync(command, {
      cwd,
      encoding: 'utf8',
      shell: true,
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL:
          process.env.DATABASE_URL ??
          'sqlserver://localhost:1433;database=ci;user=ci;password=ci;encrypt=true;trustServerCertificate=true',
      },
    });
    if (result.status !== 0) {
      throw new Error(`pre-push check failed: ${label}`);
    }
  };
}

export const sharedChecks = [
  ['pnpm format:check', 'Prettier check'],
  [
    'pnpm changelog:test && pnpm changelog:check && pnpm test:worktree-paths',
    'Changelog drift check',
  ],
];

export const apiChecks = [
  ['pnpm openapi:check', 'OpenAPI client drift check'],
  ['pnpm permissions:check', 'Permissions catalog drift check'],
  [
    'pnpm --filter @poc-plattform-kit/api... run lint && pnpm --filter "./pillars/**" run lint && pnpm exec eslint .',
    'Lint (api + pillars + packages)',
  ],
  [
    'pnpm --filter @poc-plattform-kit/api... run test && pnpm --filter "./pillars/**" run test',
    'Test (api + pillars + packages)',
  ],
  [
    'pnpm --filter @poc-plattform-kit/api... run build && pnpm --filter "./pillars/**" run build',
    'Build (api + pillars + packages)',
  ],
];

export const webChecks = [
  [
    'pnpm --filter @poc-plattform-kit/web... run lint && pnpm --filter @poc-plattform-kit/marketing... run lint && pnpm --filter @poc-plattform-kit/marketing-oauth... run lint && pnpm exec eslint .',
    'Lint (web + marketing + packages)',
  ],
  [
    'pnpm --filter @poc-plattform-kit/web... run build && pnpm --filter @poc-plattform-kit/web run build-storybook && pnpm --filter @poc-plattform-kit/marketing... run build && pnpm --filter @poc-plattform-kit/marketing-oauth... run build',
    'Build (web + marketing + packages)',
  ],
  [
    'pnpm --filter @poc-plattform-kit/web... run test && pnpm --filter @poc-plattform-kit/marketing... run test && pnpm --filter @poc-plattform-kit/marketing-oauth... run test',
    'Test (web + marketing + packages)',
  ],
];

export function plannedCommands(plan) {
  const commands = [];
  const seen = new Set();

  const add = (entries) => {
    for (const entry of entries) {
      const key = entry[0];
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      commands.push(entry);
    }
  };

  if (plan.api || plan.web) {
    add(sharedChecks);
  }
  if (plan.api) {
    add(apiChecks);
  }
  if (plan.web) {
    add(webChecks);
  }
  return commands;
}

export function runPlannedChecks(plan, { runCommand, dryRun = false } = {}) {
  const commands = plannedCommands(plan);
  if (commands.length === 0) {
    return { ran: false, commands: [] };
  }

  if (dryRun) {
    return { ran: true, commands: commands.map(([, label]) => label) };
  }

  for (const [command, label] of commands) {
    runCommand(command, label);
  }
  return { ran: true, commands: commands.map(([, label]) => label) };
}

function parseArgs(argv) {
  const args = { dryRun: false, files: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    if (arg.startsWith('--files=')) {
      args.files = arg.slice('--files='.length);
      continue;
    }
    if (arg === '--files') {
      args.files = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

function readStdin() {
  if (process.stdin.isTTY) {
    return '';
  }
  return readFileSync(0, 'utf8');
}

export function main(argv = process.argv.slice(2), deps = {}) {
  if (process.env.SKIP_PREPUSH === '1') {
    console.warn('pre-push: SKIP_PREPUSH=1 — skipping checks');
    return 0;
  }

  const args = parseArgs(argv);
  const runGit = deps.runGit ?? createGitRunner();
  const runCommand = deps.runCommand ?? createCommandRunner();
  const changedFiles =
    args.files != null
      ? args.files.split(',').map(normalizePath).filter(Boolean)
      : collectChangedFilesFromStdin(deps.stdin ?? readStdin(), runGit);

  if (changedFiles.length === 0) {
    console.log('pre-push: no commits to verify — skipping checks');
    return 0;
  }

  const plan = buildCheckPlan(changedFiles);
  if (!plan.api && !plan.web) {
    console.log('pre-push: no CI-relevant paths in push — skipping checks');
    console.log(`  files: ${plan.paths.join(', ')}`);
    return 0;
  }

  const suites = [plan.api ? 'api' : null, plan.web ? 'web' : null].filter(Boolean).join(' + ');
  console.log(`pre-push: running ${suites} checks for ${plan.paths.length} changed file(s)`);

  const result = runPlannedChecks(plan, { runCommand, dryRun: args.dryRun });
  if (args.dryRun) {
    console.log('pre-push dry-run steps:');
    for (const label of result.commands) {
      console.log(`  - ${label}`);
    }
    return 0;
  }

  console.log('\npre-push: all checks passed');
  return 0;
}

const invokedDirectly =
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  try {
    process.exit(main());
  } catch (error) {
    console.error(`\n${error instanceof Error ? error.message : error}`);
    console.error(
      '\npre-push blocked. Fix the failures above or use SKIP_PREPUSH=1 for emergencies.',
    );
    process.exit(1);
  }
}
