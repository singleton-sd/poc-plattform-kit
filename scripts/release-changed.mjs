#!/usr/bin/env node
/**
 * Path-aware independent releases for the pnpm monorepo.
 *
 * Bumps each workspace package that has releasable conventional commits since
 * its last `@scope/name@version` tag, cascades web/api when shared paths
 * change, then creates one git commit + per-package tags.
 *
 * Usage:
 *   node scripts/release-changed.mjs           # dry-run
 *   node scripts/release-changed.mjs --ci      # bump, commit, tag, push
 */
import { execFileSync, execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import semver from 'semver';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const CI = process.argv.includes('--ci');
const RELEASE_SUBJECT = 'chore: Release package versions';

/** @typedef {'major' | 'minor' | 'patch'} Increment */

/**
 * @param {string} command
 * @param {import('node:child_process').ExecSyncOptions} [options]
 */
function sh(command, options = {}) {
  return execSync(command, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  }).trim();
}

/**
 * @param {string} file
 * @param {string[]} args
 * @param {import('node:child_process').ExecFileSyncOptions} [options]
 */
function run(file, args, options = {}) {
  return execFileSync(file, args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  }).trim();
}

/**
 * @returns {{ name: string, path: string, version: string }[]}
 */
function listWorkspacePackages() {
  const raw = sh('pnpm m ls --json -r --depth -1');
  /** @type {unknown} */
  const parsed = JSON.parse(raw || '[]');
  const list = Array.isArray(parsed) ? parsed : [parsed];
  return list
    .filter(
      (pkg) =>
        pkg &&
        typeof pkg === 'object' &&
        'name' in pkg &&
        typeof pkg.name === 'string' &&
        pkg.name.startsWith('@poc-plattform-kit/') &&
        'path' in pkg &&
        typeof pkg.path === 'string',
    )
    .map((pkg) => {
      const pkgJsonPath = join(pkg.path, 'package.json');
      const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
      return {
        name: pkg.name,
        path: pkg.path,
        version: typeof pkgJson.version === 'string' ? pkgJson.version : '0.0.0',
      };
    });
}

/**
 * @param {string} packageName
 * @returns {string | null}
 */
function getLastTag(packageName) {
  const tags = sh(`git tag -l "${packageName}@*" --sort=-v:refname`)
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean);
  return tags[0] ?? null;
}

/**
 * Paths whose commits should count toward a package bump (incl. cascade).
 * @param {{ name: string, path: string }} pkg
 * @returns {string[]}
 */
function watchPathsFor(pkg) {
  const rel = relative(ROOT, pkg.path).replace(/\\/g, '/');
  const paths = [rel];

  if (pkg.name === '@poc-plattform-kit/api') {
    paths.push('packages', 'pillars');
  }
  if (pkg.name === '@poc-plattform-kit/web') {
    paths.push('packages');
  }

  return paths;
}

/**
 * @param {string | null} sinceTag
 * @param {string[]} paths
 * @returns {string[]}
 */
function getCommitMessages(sinceTag, paths) {
  const range = sinceTag ? `${sinceTag}..HEAD` : 'HEAD';
  const args = ['log', range, '--format=%B%x1e', '--'];
  args.push(...paths);
  try {
    const out = run('git', args);
    if (!out) return [];
    return out
      .split('\x1e')
      .map((m) => m.trim())
      .filter(Boolean);
  } catch {
    // Empty range (e.g. tag points at HEAD) → no commits.
    return [];
  }
}

/**
 * @param {string[]} messages
 * @returns {Increment | null}
 */
function deriveIncrement(messages) {
  /** @type {Increment | null} */
  let bump = null;
  const rank = { patch: 1, minor: 2, major: 3 };

  for (const message of messages) {
    const subject = message.split('\n')[0] ?? '';
    if (subject.startsWith('chore: Release')) continue;

    const lower = message.toLowerCase();
    if (
      /^breaking change:/m.test(lower) ||
      /^(feat|fix|perf|refactor)(\([^)]*\))?!:/m.test(message)
    ) {
      bump = 'major';
      break;
    }

    if (/^feat(\([^)]*\))?:/m.test(message)) {
      if (!bump || rank.minor > rank[bump]) bump = 'minor';
      continue;
    }

    if (/^(fix|perf)(\([^)]*\))?:/m.test(message)) {
      if (!bump || rank.patch > rank[bump]) bump = 'patch';
    }
  }

  return bump;
}

/**
 * @param {string} current
 * @param {Increment} increment
 */
function nextVersion(current, increment) {
  const base = semver.valid(current) ? current : '0.0.0';
  const next = semver.inc(base, increment);
  if (!next) {
    throw new Error(`Failed to bump ${current} with ${increment}`);
  }
  return next;
}

/**
 * @param {{ name: string, version: string, next: string, increment: Increment }[]} releases
 */
function updateChangelog(releases) {
  const changelogPath = join(ROOT, 'CHANGELOG.md');
  const date = new Date().toISOString().slice(0, 10);
  const section = [
    `## ${date}`,
    '',
    ...releases.map((r) => `- **${r.name}** \`${r.version}\` → \`${r.next}\` (${r.increment})`),
    '',
  ].join('\n');

  if (existsSync(changelogPath)) {
    const existing = readFileSync(changelogPath, 'utf8');
    const withoutHeader = existing.replace(/^# Changelog\r?\n\r?\n?/, '');
    writeFileSync(changelogPath, `# Changelog\n\n${section}${withoutHeader}`);
  } else {
    writeFileSync(changelogPath, `# Changelog\n\n${section}`);
  }
}

/**
 * @param {string} packagePath
 * @param {string} version
 */
function writePackageVersion(packagePath, version) {
  const pkgJsonPath = join(packagePath, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
  pkg.version = version;
  writeFileSync(pkgJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);
}

/**
 * Write the computed next version into package.json.
 * (release-it is available via `.release-it.json` for manual/single-package use;
 * the orchestrator owns path-filtered increments so versions stay consistent.)
 * @param {{ path: string, next: string }} release
 */
function bumpPackageVersion(release) {
  writePackageVersion(release.path, release.next);
}

function main() {
  const packages = listWorkspacePackages();
  if (packages.length === 0) {
    console.log('No workspace packages found.');
    return;
  }

  /** @type {{ name: string, path: string, version: string, next: string, increment: Increment, tag: string }[]} */
  const releases = [];

  for (const pkg of packages) {
    const lastTag = getLastTag(pkg.name);
    const paths = watchPathsFor(pkg);
    const messages = getCommitMessages(lastTag, paths);
    const increment = deriveIncrement(messages);
    if (!increment) continue;

    const next = nextVersion(pkg.version, increment);
    releases.push({
      name: pkg.name,
      path: pkg.path,
      version: pkg.version,
      next,
      increment,
      tag: `${pkg.name}@${next}`,
    });
  }

  if (releases.length === 0) {
    console.log('Nothing to release.');
    return;
  }

  console.log(CI ? 'Releasing:' : 'Dry-run — would release:');
  for (const r of releases) {
    console.log(`  ${r.name}: ${r.version} → ${r.next} (${r.increment}) [${r.tag}]`);
  }

  if (!CI) {
    console.log('\nRe-run with --ci to bump, commit, tag, and push.');
    return;
  }

  for (const release of releases) {
    bumpPackageVersion(release);
  }

  updateChangelog(releases);

  const body = releases.map((r) => `- ${r.tag}`).join('\n');
  const message = `${RELEASE_SUBJECT}\n\n${body}\n`;

  for (const release of releases) {
    run('git', ['add', join(release.path, 'package.json')]);
  }
  run('git', ['add', 'CHANGELOG.md']);
  // Release commits are auto-generated; bypass hooks (ticket rule / lint-staged).
  run('git', ['commit', '-m', message], {
    env: { ...process.env, HUSKY: '0' },
  });

  for (const release of releases) {
    run('git', ['tag', '-a', release.tag, '-m', release.tag]);
  }

  run('git', ['push', 'origin', 'HEAD', '--follow-tags']);
  console.log('Release commit and tags pushed.');
}

main();
