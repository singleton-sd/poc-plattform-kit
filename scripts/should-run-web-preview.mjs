#!/usr/bin/env node
// Decides whether preview-web.yml should build/deploy a SWA PR preview.
// Keep the workflow's on.pull_request.paths filter broad (GitHub cannot combine
// paths + paths-ignore usefully), then skip when every matching change is
// committed OpenAPI/Orval output — see PR #165 and docs/pr-pipelines.md.
//
// Usage:
//   node scripts/should-run-web-preview.mjs --changed-files=changed-files.txt
//   echo 'true'|'false' on stdout; exit 0.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/** Paths that match `.github/workflows/preview-web.yml` `on.pull_request.paths`. */
export const WEB_PREVIEW_PATH_PREFIXES = [
  'apps/web/',
  'packages/',
  '.github/workflows/preview-web.yml',
  'scripts/entra-spa-preview-redirect.sh',
  'scripts/entra-spa-preview-redirect.mjs',
];

/** Generated OpenAPI + Orval output — alone these must not burn SWA staging slots. */
export const GENERATED_ONLY_PATHS = [
  'packages/api-client/openapi.json',
  'packages/api-client/src/generated/',
];

export function isWebPreviewRelevant(filePath) {
  const normalized = filePath.replaceAll('\\', '/');
  return WEB_PREVIEW_PATH_PREFIXES.some((prefix) => {
    if (prefix.endsWith('/')) {
      return normalized.startsWith(prefix) || normalized === prefix.slice(0, -1);
    }
    return normalized === prefix;
  });
}

export function isGeneratedOnly(filePath) {
  const normalized = filePath.replaceAll('\\', '/');
  return GENERATED_ONLY_PATHS.some((prefix) => {
    if (prefix.endsWith('/')) {
      return normalized.startsWith(prefix);
    }
    return normalized === prefix;
  });
}

/**
 * Returns true when SWA build/deploy should run.
 * Among files that match the web-preview path globs, if every match is
 * generated-only (or there are no matches), returns false.
 */
export function shouldRunWebPreview(changedFiles) {
  const relevant = (changedFiles ?? [])
    .map((f) => String(f).trim())
    .filter(Boolean)
    .filter(isWebPreviewRelevant);

  if (relevant.length === 0) {
    return false;
  }

  return relevant.some((file) => !isGeneratedOnly(file));
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--changed-files=')) {
      out.changedFiles = arg.slice('--changed-files='.length);
      continue;
    }
    if (arg === '--changed-files') {
      out.changedFiles = argv[i + 1];
      i += 1;
    }
  }
  return out;
}

function main(argv) {
  const args = parseArgs(argv);
  if (!args.changedFiles) {
    throw new Error('Usage: node scripts/should-run-web-preview.mjs --changed-files=<path>');
  }
  const text = readFileSync(args.changedFiles, 'utf8');
  const files = text.split(/\r?\n/);
  const shouldRun = shouldRunWebPreview(files);
  process.stdout.write(shouldRun ? 'true\n' : 'false\n');
}

const invokedDirectly =
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
