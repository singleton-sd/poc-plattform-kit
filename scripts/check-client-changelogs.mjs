#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import semver from 'semver';
import { CLIENT_CHANGELOG_TARGETS, parseProductChangelog } from './client-changelog.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

function assertNewestFirst(releases, product) {
  for (const release of releases) {
    if (!semver.valid(release.version)) {
      throw new Error(`${product}: ${release.version} is not a valid semantic version`);
    }
  }
  for (let index = 1; index < releases.length; index += 1) {
    const previous = releases[index - 1]?.version;
    const current = releases[index]?.version;
    if (semver.lt(previous, current)) {
      throw new Error(`${product}: releases must use newest-first semantic version order`);
    }
  }
}

export function validateProductProjection(product, markdown, projection) {
  if (projection.product !== product) {
    throw new Error(
      `${product}: generated JSON contains product ${projection.product ?? '<missing>'}`,
    );
  }
  if (!Array.isArray(projection.releases)) {
    throw new Error(`${product}: generated JSON is missing releases`);
  }

  assertNewestFirst(projection.releases, product);
  const canonical = parseProductChangelog(markdown);
  if (JSON.stringify(canonical) !== JSON.stringify(projection.releases)) {
    throw new Error(`${product}: generated JSON does not match canonical Markdown`);
  }
}

export function checkClientChangelogs(root = ROOT) {
  for (const [product, targets] of Object.entries(CLIENT_CHANGELOG_TARGETS)) {
    const markdown = readFileSync(resolve(root, targets.markdown), 'utf8');
    const projection = JSON.parse(readFileSync(resolve(root, targets.data), 'utf8'));
    validateProductProjection(product, markdown, projection);
    console.log(`OK ${product}: ${projection.releases.length} releases`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) checkClientChangelogs();
