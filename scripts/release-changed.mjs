#!/usr/bin/env node
/**
 * Path-aware independent releases for the pnpm monorepo.
 *
 * Bumps each workspace package that has releasable conventional commits since
 * its last `@scope/name@version` tag (reachable from HEAD), cascades web/api
 * when shared paths change, then creates one git commit + per-package tags.
 *
 * Push order is commit-then-tags (never `--follow-tags`): a non-fast-forward
 * race must not publish tags without the release commit on main.
 *
 * When `@poc-plattform-kit/api` is bumped, also runs `pnpm openapi:export` and
 * `pnpm openapi:generate` so committed OpenAPI `info.version` matches the
 * package version (avoids `openapi:check` drift on main).
 *
 * Usage:
 *   node scripts/release-changed.mjs           # dry-run
 *   node scripts/release-changed.mjs --ci      # bump, commit, tag, push main
 */
import { execFileSync, execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import semver from 'semver';
import { CLIENT_CHANGELOG_TARGETS, updateClientChangelogs } from './client-changelog.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const CI = process.argv.includes('--ci');
const RELEASE_SUBJECT = 'chore: Release package versions';
const API_PACKAGE = '@poc-plattform-kit/api';
/** Paths refreshed when the API package version bumps (Swagger reads package.json). */
const OPENAPI_CLIENT_PATHS = [
  'packages/api-client/openapi.json',
  'packages/api-client/src/generated',
];

/** @typedef {'major' | 'minor' | 'patch'} Increment */

/**
 * @param {string} command
 * @param {import('node:child_process').ExecSyncOptions} [options]
 */
function sh(command, options = {}) {
  const out = execSync(command, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
  return typeof out === 'string' ? out.trim() : '';
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
 * True when `ref` is an ancestor of HEAD (tag commit is on this branch history).
 * @param {string} ref
 */
function isAncestorOfHead(ref) {
  try {
    run('git', ['merge-base', '--is-ancestor', ref, 'HEAD']);
    return true;
  } catch {
    return false;
  }
}

/**
 * Highest semver tag for the package that is reachable from HEAD.
 * Ignores orphaned tags left behind when a release push rejected the branch
 * but still published tags (`git push --follow-tags` is not atomic).
 * @param {string} packageName
 * @returns {string | null}
 */
function getLastTag(packageName) {
  const tags = sh(`git tag -l "${packageName}@*" --sort=-v:refname`)
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean);
  for (const tag of tags) {
    if (isAncestorOfHead(tag)) return tag;
  }
  return null;
}

/**
 * @param {string} packageName
 * @param {string | null} tag
 * @returns {string | null}
 */
function versionFromTag(packageName, tag) {
  if (!tag) return null;
  const prefix = `${packageName}@`;
  if (!tag.startsWith(prefix)) return null;
  const version = tag.slice(prefix.length);
  return semver.valid(version) ? version : null;
}

/**
 * @param {string} tag
 */
function tagExists(tag) {
  try {
    run('git', ['rev-parse', '-q', '--verify', `refs/tags/${tag}`]);
    return true;
  } catch {
    return false;
  }
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
 * Max of package.json version and last reachable tag, then bump until the
 * target tag name is free (skips orphaned remote tags).
 * @param {string} packageName
 * @param {string} packageVersion
 * @param {string | null} lastTag
 * @param {Increment} increment
 * @returns {{ base: string, next: string, tag: string }}
 */
function resolveNextVersion(packageName, packageVersion, lastTag, increment) {
  const tagVersion = versionFromTag(packageName, lastTag);
  const candidates = [packageVersion, tagVersion].filter(
    (v) => typeof v === 'string' && Boolean(semver.valid(v)),
  );
  let base = candidates.length > 0 ? candidates.sort(semver.rcompare)[0] : '0.0.0';

  const from = base;

  for (let i = 0; i < 50; i += 1) {
    const next = nextVersion(base, increment);
    const tag = `${packageName}@${next}`;
    if (!tagExists(tag)) {
      return { base: from, next, tag };
    }
    console.warn(`Tag ${tag} already exists — skipping to next ${increment}.`);
    base = next;
  }

  throw new Error(`Could not find a free version for ${packageName} after ${base}`);
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
    ...releases.map((r) => {
      const target = CLIENT_CHANGELOG_TARGETS[r.name];
      const name = target ? `[${r.name}](${target.markdown})` : r.name;
      return `- **${name}** \`${r.version}\` → \`${r.next}\` (${r.increment})`;
    }),
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

/**
 * Nest Swagger `info.version` comes from apps/api/package.json. After an API
 * bump, re-export + regenerate so `pnpm openapi:check` stays green on main.
 * Requires DATABASE_URL (placeholder is fine) for Prisma generate during export.
 */
function refreshOpenApiClient() {
  console.log('Refreshing OpenAPI client after API version bump...');
  sh('pnpm openapi:export', { stdio: 'inherit' });
  sh('pnpm openapi:generate', { stdio: 'inherit' });
  console.log('OpenAPI client refreshed.');
}

/**
 * Sync to origin/main before computing bumps so concurrent pushes do not
 * release from a stale tip.
 */
function syncToOriginMain() {
  run('git', ['fetch', 'origin', 'main', '--tags']);
  const head = run('git', ['rev-parse', 'HEAD']);
  const main = run('git', ['rev-parse', 'origin/main']);
  if (head === main) return;
  console.log(`Updating HEAD ${head.slice(0, 7)} → origin/main ${main.slice(0, 7)}`);
  run('git', ['reset', '--hard', 'origin/main']);
}

/**
 * Push the release commit to main. Requires the main ruleset to bypass the
 * GitHub Actions integration (actor_id 15368, bypass_mode always) — see
 * SETUP.md. Retries after rebase when concurrent main updates cause rejection.
 */
function pushReleaseCommit() {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      run('git', ['push', 'origin', 'HEAD:main']);
      return;
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      console.log(
        `Push rejected (attempt ${attempt}/${maxAttempts}); rebasing onto origin/main...`,
      );
      run('git', ['fetch', 'origin', 'main']);
      run('git', ['pull', '--rebase', '--autostash', 'origin', 'main']);
    }
  }
}

/**
 * Create and push annotated tags only after HEAD is on origin/main.
 * Never use `git push --follow-tags`: git can accept new tags while rejecting
 * a non-fast-forward main update, leaving orphan tags that block later releases.
 * @param {string[]} tags
 */
function createAndPushTags(tags) {
  for (const tag of tags) {
    if (tagExists(tag)) {
      run('git', ['tag', '-d', tag]);
    }
    run('git', ['tag', '-a', tag, '-m', tag]);
  }
  if (tags.length > 0) {
    run('git', ['push', 'origin', ...tags]);
  }
}

function main() {
  if (CI) {
    syncToOriginMain();
  }

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

    const resolved = resolveNextVersion(pkg.name, pkg.version, lastTag, increment);
    releases.push({
      name: pkg.name,
      path: pkg.path,
      version: resolved.base,
      next: resolved.next,
      increment,
      tag: resolved.tag,
      messages,
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

  const apiReleased = releases.some((r) => r.name === API_PACKAGE);
  if (apiReleased) {
    console.log(
      CI
        ? 'API bumped - will refresh OpenAPI client before commit.'
        : 'Would also refresh OpenAPI client (pnpm openapi:export && pnpm openapi:generate).',
    );
  }

  if (!CI) {
    console.log('\nRe-run with --ci to bump, commit, tag, and push.');
    return;
  }

  for (const release of releases) {
    bumpPackageVersion(release);
  }

  if (apiReleased) {
    refreshOpenApiClient();
  }

  updateChangelog(releases);
  updateClientChangelogs(ROOT, releases, new Date().toISOString().slice(0, 10));

  const body = releases.map((r) => `- ${r.tag}`).join('\n');
  const message = `${RELEASE_SUBJECT}\n\n${body}\n`;

  for (const release of releases) {
    run('git', ['add', join(release.path, 'package.json')]);
  }
  run('git', ['add', 'CHANGELOG.md']);
  for (const release of releases) {
    const targets = CLIENT_CHANGELOG_TARGETS[release.name];
    if (targets) run('git', ['add', targets.markdown, targets.data]);
  }
  if (apiReleased) {
    run('git', ['add', ...OPENAPI_CLIENT_PATHS]);
  }
  // Release commits are auto-generated; bypass hooks (ticket rule / lint-staged).
  run('git', ['commit', '-m', message], {
    env: { ...process.env, HUSKY: '0' },
  });

  // Commit first, then tag. Tagging before a rebase-on-push-failure leaves
  // tags pointing at a rewritten commit SHA.
  pushReleaseCommit();
  createAndPushTags(releases.map((r) => r.tag));
  console.log('Release commit and tags pushed.');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
