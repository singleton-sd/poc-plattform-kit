#!/usr/bin/env node
/**
 * Path-aware independent releases for the pnpm monorepo.
 *
 * Computes the next semver for each workspace package from the latest
 * `@scope/name@version` git tag (reachable from HEAD) plus conventional
 * commits since then. Cascades web/api when shared paths change.
 *
 * CI creates and pushes **annotated tags only** — it never commits, never
 * writes package.json / CHANGELOG.md, and never pushes the default branch.
 * GitHub Releases are published by `.github/workflows/release.yml` from
 * those tags. Build/publish jobs derive the version from the tag.
 *
 * Usage:
 *   node scripts/release-changed.mjs           # dry-run
 *   node scripts/release-changed.mjs --ci      # tag + push tags (no commit)
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import semver from 'semver';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const CI = process.argv.includes('--ci');
const RECONCILE_TAGS = process.argv.includes('--reconcile-tags');

/** @typedef {'major' | 'minor' | 'patch'} Increment */

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
  const raw = run('pnpm', ['m', 'ls', '--json', '-r', '--depth', '-1']);
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
 * Ignores orphaned tags left behind when a previous release published tags
 * that are not on this branch.
 * @param {string} packageName
 * @returns {string | null}
 */
export function getLastTag(packageName) {
  const tags = run('git', ['tag', '--sort=-v:refname', '-l', `${packageName}@*`])
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean);
  for (const tag of tags) {
    if (isAncestorOfHead(tag)) return tag;
  }
  return null;
}

/**
 * Tags that should have a GitHub Release even when this run has nothing new
 * to tag (retry after `gh release create` failed, or latest package tags
 * that never got a Release). Never writes CHANGELOG.md.
 *
 * @param {string[]} [extraTags]
 * @param {{ tagsAtHead?: string[], latestTags?: (string | null | undefined)[] }} [options]
 * @returns {string[]}
 */
export function collectTagsToReconcile(extraTags = [], options = {}) {
  const tags = new Set();
  for (const tag of extraTags) {
    if (typeof tag === 'string' && tag.trim()) tags.add(tag.trim());
  }

  const atHead =
    options.tagsAtHead ??
    (() => {
      try {
        return run('git', ['tag', '--points-at', 'HEAD', '-l', '@poc-plattform-kit/*'])
          .split('\n')
          .map((t) => t.trim())
          .filter(Boolean);
      } catch {
        return [];
      }
    })();
  for (const tag of atHead) tags.add(tag);

  if (options.latestTags) {
    for (const tag of options.latestTags) {
      if (typeof tag === 'string' && tag.trim()) tags.add(tag.trim());
    }
  } else {
    for (const pkg of listWorkspacePackages()) {
      const last = getLastTag(pkg.name);
      if (last) tags.add(last);
    }
  }

  return [...tags].sort();
}

/**
 * @param {string} packageName
 * @param {string | null | undefined} tag
 * @returns {string | null}
 */
export function versionFromTag(packageName, tag) {
  if (!tag) return null;
  const prefix = `${packageName}@`;
  if (!tag.startsWith(prefix)) return null;
  const version = tag.slice(prefix.length);
  return semver.valid(version) ? version : null;
}

/**
 * @param {string} tag
 */
export function tagExists(tag) {
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
export function watchPathsFor(pkg) {
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
export function getCommitMessages(sinceTag, paths) {
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
export function deriveIncrement(messages) {
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
export function nextVersion(current, increment) {
  const base = semver.valid(current) ? current : '0.0.0';
  const next = semver.inc(base, increment);
  if (!next) {
    throw new Error(`Failed to bump ${current} with ${increment}`);
  }
  return next;
}

/**
 * Next free `@scope/name@version` from the latest reachable tag.
 * package.json is only a bootstrap when the package has never been tagged.
 * @param {string} packageName
 * @param {string | null} lastTag
 * @param {Increment} increment
 * @param {string} [packageVersion]
 * @param {(tag: string) => boolean} [exists]
 * @returns {{ base: string, next: string, tag: string }}
 */
export function resolveNextVersion(
  packageName,
  lastTag,
  increment,
  packageVersion = '0.0.0',
  exists = tagExists,
) {
  const tagVersion = versionFromTag(packageName, lastTag);
  const fallback =
    typeof packageVersion === 'string' && semver.valid(packageVersion) ? packageVersion : '0.0.0';
  let base = tagVersion ?? fallback;
  const from = base;

  for (let i = 0; i < 50; i += 1) {
    const next = nextVersion(base, increment);
    const tag = `${packageName}@${next}`;
    if (!exists(tag)) {
      return { base: from, next, tag };
    }
    console.warn(`Tag ${tag} already exists — skipping to next ${increment}.`);
    base = next;
  }

  throw new Error(`Could not find a free version for ${packageName} after ${base}`);
}

/**
 * Sync to origin/main before computing bumps so concurrent pushes do not
 * release from a stale tip. Does not push the default branch.
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
 * Create and push annotated tags at HEAD. Never push a branch.
 * @param {string[]} tags
 */
function createAndPushTags(tags) {
  const gitEnv = { ...process.env, HUSKY: '0' };
  for (const tag of tags) {
    if (tagExists(tag)) {
      run('git', ['tag', '-d', tag]);
    }
    run('git', ['tag', '-a', tag, '-m', tag]);
  }
  if (tags.length > 0) {
    run('git', ['push', 'origin', ...tags], { env: gitEnv });
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
  /** @type {{ name: string, lastTag: string | null, increment: Increment | null }[]} */
  const scan = [];

  for (const pkg of packages) {
    const lastTag = getLastTag(pkg.name);
    const paths = watchPathsFor(pkg);
    const messages = getCommitMessages(lastTag, paths);
    const increment = deriveIncrement(messages);
    scan.push({ name: pkg.name, lastTag, increment });
    if (!increment) continue;

    const resolved = resolveNextVersion(pkg.name, lastTag, increment, pkg.version);
    releases.push({
      name: pkg.name,
      path: pkg.path,
      version: resolved.base,
      next: resolved.next,
      increment,
      tag: resolved.tag,
    });
  }

  if (!CI) {
    console.log('Dry-run — per-package scan (version source = latest git tag):');
    for (const row of scan) {
      const last = row.lastTag ?? 'no tag';
      const bump = row.increment ?? 'none';
      console.log(`  ${row.name}: last=${last} bump=${bump}`);
    }
    console.log('');
  }

  if (releases.length === 0) {
    if (CI) {
      console.log(`RELEASE_SHA=${run('git', ['rev-parse', 'HEAD'])}`);
    }
    console.log('Nothing to release.');
    return;
  }

  console.log(CI ? 'Releasing:' : 'Dry-run — would tag:');
  for (const r of releases) {
    console.log(`  ${r.name}: ${r.version} → ${r.next} (${r.increment}) [${r.tag}]`);
  }

  if (!CI) {
    console.log('\nRe-run with --ci to create and push tags only (no commit to main).');
    return;
  }

  const tags = releases.map((r) => r.tag);
  createAndPushTags(tags);
  console.log(`RELEASE_SHA=${run('git', ['rev-parse', 'HEAD'])}`);
  console.log(`RELEASE_TAGS=${tags.join(',')}`);
  console.log('Release tags pushed.');
}

function printReconcileTags() {
  const extra = (process.env.RELEASE_TAGS || '').split(',');
  for (const tag of collectTagsToReconcile(extra)) {
    console.log(tag);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  if (RECONCILE_TAGS) {
    printReconcileTags();
  } else {
    main();
  }
}
