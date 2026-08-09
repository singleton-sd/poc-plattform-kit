#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import semver from 'semver';
import {
  CLIENT_CHANGELOG_TARGETS,
  clientFacingChanges,
  formatProductChangelog,
  parseProductChangelog,
} from './client-changelog.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PRODUCTS = {
  '@poc-plattform-kit/api': ['apps/api', 'packages', 'pillars'],
  '@poc-plattform-kit/web': ['apps/web', 'packages'],
  '@poc-plattform-kit/marketing': ['apps/marketing'],
};

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

export function versionsFromTags(product, tags) {
  const prefix = `${product}@`;
  return tags
    .filter((tag) => tag.startsWith(prefix) && semver.valid(tag.slice(prefix.length)))
    .map((tag) => ({ tag, version: tag.slice(prefix.length) }))
    .sort((left, right) => semver.compare(left.version, right.version));
}

export function assertCompleteTagHistory(product, existingReleases, taggedVersions) {
  const available = new Set(taggedVersions.map(({ version }) => version));
  const missing = existingReleases
    .map(({ version }) => version)
    .filter((version) => !available.has(version));
  if (missing.length) {
    throw new Error(
      `Release tags are incomplete for ${product} (missing ${missing.join(', ')}); run git fetch origin --tags`,
    );
  }
}

function messagesBetween(fromTag, toTag, paths) {
  const range = fromTag ? `${fromTag}..${toTag}` : toTag;
  const output = git(['log', range, '--format=%B%x1e', '--', ...paths]);
  return output
    .split('\x1e')
    .map((message) => message.trim())
    .filter(Boolean);
}

export function backfillProduct(product, paths, tags) {
  const versions = versionsFromTags(product, tags);
  return versions
    .map((entry, index) => ({
      version: entry.version,
      date: git(['show', '-s', '--format=%cs', `${entry.tag}^{commit}`]),
      changes: clientFacingChanges(
        messagesBetween(index > 0 ? versions[index - 1].tag : null, entry.tag, paths),
      ),
    }))
    .reverse();
}

export function writeProductHistory(product, releases) {
  const targets = CLIENT_CHANGELOG_TARGETS[product];
  const markdown = formatProductChangelog(product, releases);
  writeFileSync(resolve(ROOT, targets.markdown), markdown);
  const projected = parseProductChangelog(markdown);
  writeFileSync(
    resolve(ROOT, targets.data),
    `${JSON.stringify({ product, releases: projected }, null, 2)}\n`,
  );
}

export function validateBackfillCoverage(tags, readMarkdown) {
  for (const product of Object.keys(PRODUCTS)) {
    const targets = CLIENT_CHANGELOG_TARGETS[product];
    const taggedVersions = versionsFromTags(product, tags);
    const existingReleases = parseProductChangelog(readMarkdown(targets.markdown));
    assertCompleteTagHistory(product, existingReleases, taggedVersions);
  }
}

function main() {
  const dryRun = process.argv.includes('--dry-run');
  const tags = git(['tag', '--list']).split('\n').filter(Boolean);
  const readMarkdown = (relativePath) => readFileSync(resolve(ROOT, relativePath), 'utf8');

  // Validate every product before rewriting any history.
  validateBackfillCoverage(tags, readMarkdown);

  const plans = [];
  for (const [product, paths] of Object.entries(PRODUCTS)) {
    const targets = CLIENT_CHANGELOG_TARGETS[product];
    const releases = backfillProduct(product, paths, tags);
    if (!releases.length) {
      throw new Error(`No release tags found for ${product}; run git fetch origin --tags`);
    }
    plans.push({ product, targets, releases });
  }

  for (const { product, targets, releases } of plans) {
    if (!dryRun) writeProductHistory(product, releases);
    console.log(
      `${dryRun ? 'Would write' : 'Wrote'} ${releases.length} releases to ${targets.markdown}`,
    );
  }

  if (dryRun) return;
  // Ensure the generated files can be read after writing them.
  for (const targets of Object.values(CLIENT_CHANGELOG_TARGETS)) {
    parseProductChangelog(readFileSync(resolve(ROOT, targets.markdown), 'utf8'));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
