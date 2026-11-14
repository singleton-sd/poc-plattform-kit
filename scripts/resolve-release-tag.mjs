#!/usr/bin/env node
/**
 * Resolve a per-package release tag + semver for CI build/publish jobs.
 *
 * Prefers `--tag`, then `GITHUB_REF` when it is a matching package tag,
 * then the highest `@scope/name@version` tag pointing at `--sha` (HEAD).
 *
 * Prints `found=`, `tag=`, `version=` lines and appends them to
 * `$GITHUB_OUTPUT` when that env var is set. Exits 0 when no tag matches
 * so deploy workflows can skip instead of failing.
 *
 * Usage:
 *   node scripts/resolve-release-tag.mjs --package @poc-plattform-kit/api
 *   node scripts/resolve-release-tag.mjs --package @poc-plattform-kit/web --tag '@poc-plattform-kit/web@0.17.0'
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const isCli = import.meta.url === pathToFileURL(process.argv[1] ?? '').href;

/**
 * @param {string[]} args
 */
function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

/**
 * @param {string} packageName
 * @param {string | null | undefined} tag
 * @returns {string | null}
 */
export function versionFromPackageTag(packageName, tag) {
  if (!tag) return null;
  const prefix = `${packageName}@`;
  if (!tag.startsWith(prefix)) return null;
  const version = tag.slice(prefix.length);
  return /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version) ? version : null;
}

/**
 * @param {string} a
 * @param {string} b
 */
export function compareSemver(a, b) {
  const parse = (value) => value.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const left = parse(a);
  const right = parse(b);
  for (let i = 0; i < 3; i += 1) {
    if (left[i] !== right[i]) return left[i] - right[i];
  }
  return 0;
}

/**
 * @param {string} found
 * @param {string} tag
 * @param {string} version
 */
function emit(found, tag, version) {
  const lines = [`found=${found}`, `tag=${tag}`, `version=${version}`];
  for (const line of lines) console.log(line);
  const output = process.env.GITHUB_OUTPUT;
  if (output) {
    appendFileSync(output, `${lines.join('\n')}\n`);
  }
}

function resolveTag(packageName, explicitTag, sha) {
  if (explicitTag) return explicitTag;

  const ref = process.env.GITHUB_REF ?? '';
  if (ref.startsWith('refs/tags/')) {
    const fromRef = ref.slice('refs/tags/'.length);
    if (fromRef.startsWith(`${packageName}@`)) return fromRef;
  }

  const target = sha || 'HEAD';
  let raw = '';
  try {
    raw = git(['tag', '--points-at', target, '-l', `${packageName}@*`]);
  } catch {
    return '';
  }
  const tags = raw
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean)
    .sort((left, right) => {
      const lv = versionFromPackageTag(packageName, left) ?? '0.0.0';
      const rv = versionFromPackageTag(packageName, right) ?? '0.0.0';
      return compareSemver(lv, rv);
    });
  return tags.at(-1) ?? '';
}

function main() {
  const { values } = parseArgs({
    options: {
      package: { type: 'string' },
      tag: { type: 'string' },
      sha: { type: 'string' },
    },
  });

  if (!values.package) {
    console.error(
      'Usage: node scripts/resolve-release-tag.mjs --package @poc-plattform-kit/api [--tag TAG] [--sha SHA]',
    );
    process.exit(2);
  }

  const tag = resolveTag(values.package, values.tag, values.sha);
  const version = versionFromPackageTag(values.package, tag);
  if (!tag || !version) {
    emit('false', '', '');
    process.exit(0);
  }
  emit('true', tag, version);
}

if (isCli) {
  main();
}
