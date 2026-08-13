#!/usr/bin/env node
/**
 * Helpers + tiny CLI for Entra SPA redirect URI updates on SWA and ACA
 * web PR previews.
 *
 * CLI:
 *   node entra-spa-preview-redirect.mjs normalize <url>
 *   node entra-spa-preview-redirect.mjs build <defaultHostname> <pr> [region]
 *   node entra-spa-preview-redirect.mjs plan add|remove <spa.json> <origin>
 *   node entra-spa-preview-redirect.mjs sweep-spa <spa.json> <openPrCsv> [region]
 *
 * `plan` prints UNCHANGED or a JSON array of redirectUris.
 * `sweep-spa` prints UNCHANGED or JSON { next, remove, keep }.
 */

import fs from 'node:fs';

/**
 * @param {string} defaultHostname SWA defaultHostname (no scheme), e.g. kind-rock-….7.azurestaticapps.net
 * @param {string|number} prNumber Pull request number
 * @param {string} [region] Azure region slug inserted in PR preview hosts (default eastasia)
 * @returns {string} https origin with no trailing slash
 */
export function buildSwaPrPreviewOrigin(defaultHostname, prNumber, region = 'eastasia') {
  const host = String(defaultHostname ?? '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/$/, '');
  const pr = String(prNumber ?? '').trim();
  if (!host || !/^\d+$/.test(pr)) {
    throw new Error('defaultHostname and numeric prNumber are required');
  }
  const regionSlug = String(region ?? 'eastasia').trim() || 'eastasia';
  const parts = host.split('.');
  const unique = parts[0];
  if (!unique) {
    throw new Error(`invalid defaultHostname: ${defaultHostname}`);
  }
  const suffix = parts.slice(1);
  const previewHost = [unique + '-' + pr, regionSlug, ...suffix].join('.');
  return `https://${previewHost}`;
}

/**
 * @param {string} value
 * @returns {string}
 */
export function normalizeOrigin(value) {
  const raw = String(value ?? '').trim();
  if (!raw) {
    throw new Error('origin is required');
  }
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let url;
  try {
    url = new URL(withScheme);
  } catch {
    throw new Error(`invalid origin: ${value}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`invalid origin protocol: ${value}`);
  }
  return `${url.protocol}//${url.host}`;
}

/**
 * @param {string[]} uris
 * @param {string} origin
 * @returns {string[]}
 */
export function addRedirectUri(uris, origin) {
  const normalized = assertSpaPreviewRedirectOrigin(origin);
  const list = Array.isArray(uris) ? [...uris] : [];
  if (!list.includes(normalized)) {
    list.push(normalized);
  }
  return list;
}

/**
 * @param {string[]} uris
 * @param {string} origin
 * @returns {string[]}
 */
export function removeRedirectUri(uris, origin) {
  const normalized = normalizeOrigin(origin);
  const list = Array.isArray(uris) ? [...uris] : [];
  return list.filter((u) => u !== normalized);
}

/**
 * Parse this-repo web ACA PR preview origin.
 * Host: `ssd-pocpk-aca-web-pr-<n>-ae.<hash>.australiaeast.azurecontainerapps.io`
 *
 * @param {string} origin
 * @returns {{ pr: string, hash: string } | null}
 */
export function parseAcaWebPrPreviewOrigin(origin) {
  let normalized;
  try {
    normalized = normalizeOrigin(origin);
  } catch {
    return null;
  }
  const host = new URL(normalized).host.toLowerCase();
  const match = host.match(
    /^ssd-pocpk-aca-web-pr-(\d+)-ae\.([a-z0-9-]+)\.australiaeast\.azurecontainerapps\.io$/,
  );
  if (!match) {
    return null;
  }
  return { pr: match[1], hash: match[2] };
}

/**
 * Allow SWA / custom / localhost origins. If the host is Container Apps,
 * require the web preview app name (not the API preview app).
 *
 * @param {string} origin
 * @returns {string} normalized origin
 */
export function assertSpaPreviewRedirectOrigin(origin) {
  const normalized = normalizeOrigin(origin);
  const host = new URL(normalized).host.toLowerCase();
  if (!host.endsWith('.azurecontainerapps.io') && host !== 'azurecontainerapps.io') {
    return normalized;
  }
  if (parseAcaWebPrPreviewOrigin(normalized)) {
    return normalized;
  }
  throw new Error(`refusing Entra SPA redirect for non-web ACA host: ${normalized}`);
}

/**
 * Parse a SWA Free PR preview origin.
 * Host shape: `{unique}-{pr}.{region}.{rest}.azurestaticapps.net`
 *
 * @param {string} origin
 * @returns {{ pr: string, region: string, unique: string } | null}
 */
export function parseSwaPrPreviewOrigin(origin) {
  let normalized;
  try {
    normalized = normalizeOrigin(origin);
  } catch {
    return null;
  }
  const host = new URL(normalized).host.toLowerCase();
  if (!host.endsWith('.azurestaticapps.net')) {
    return null;
  }
  // unique-pr.region.…azurestaticapps.net (unique may contain hyphens)
  const match = host.match(/^(.+)-(\d+)\.([a-z0-9-]+)\.(.+)$/);
  if (!match) {
    return null;
  }
  const unique = match[1];
  const pr = match[2];
  const region = match[3];
  if (!unique || !pr || !region) {
    return null;
  }
  return { unique, pr, region };
}

/**
 * Drop SPA redirect URIs that look like SWA PR previews for closed PRs.
 * Non-preview URIs (localhost, production default host, etc.) are kept.
 *
 * @param {string[]} uris
 * @param {Iterable<string|number>} openPrNumbers
 * @param {string} [expectedRegion] when set, only URIs in this region are treated as PR previews
 * @returns {{ next: string[], remove: string[], keep: string[] }}
 */
export function sweepSpaPrPreviewRedirects(uris, openPrNumbers, expectedRegion = '') {
  const open = new Set(
    [...openPrNumbers].map((n) => String(n).trim()).filter((n) => /^\d+$/.test(n)),
  );
  const regionFilter = String(expectedRegion ?? '')
    .trim()
    .toLowerCase();
  const list = Array.isArray(uris) ? uris : [];
  /** @type {string[]} */
  const next = [];
  /** @type {string[]} */
  const remove = [];
  /** @type {string[]} */
  const keep = [];

  for (const uri of list) {
    const parsed = parseSwaPrPreviewOrigin(uri);
    if (!parsed) {
      next.push(uri);
      continue;
    }
    if (regionFilter && parsed.region !== regionFilter) {
      next.push(uri);
      continue;
    }
    if (open.has(parsed.pr)) {
      next.push(uri);
      keep.push(uri);
      continue;
    }
    remove.push(normalizeOrigin(uri));
  }

  return { next, remove, keep };
}

async function main(argv) {
  const [cmd, ...args] = argv;
  switch (cmd) {
    case 'normalize': {
      process.stdout.write(normalizeOrigin(args[0] ?? '') + '\n');
      return;
    }
    case 'build': {
      process.stdout.write(
        buildSwaPrPreviewOrigin(args[0] ?? '', args[1] ?? '', args[2] ?? 'eastasia') + '\n',
      );
      return;
    }
    case 'plan': {
      const action = args[0];
      const spaPath = args[1];
      const origin = args[2];
      if ((action !== 'add' && action !== 'remove') || !spaPath || !origin) {
        throw new Error('plan requires: add|remove <spa.json> <origin>');
      }
      const spa = JSON.parse(fs.readFileSync(spaPath, 'utf8')).spa ?? {};
      const uris = Array.isArray(spa.redirectUris) ? spa.redirectUris : [];
      const next =
        action === 'add' ? addRedirectUri(uris, origin) : removeRedirectUri(uris, origin);
      if (JSON.stringify(next) === JSON.stringify(uris)) {
        process.stdout.write('UNCHANGED\n');
      } else {
        process.stdout.write(JSON.stringify(next) + '\n');
      }
      return;
    }
    case 'sweep-spa': {
      const spaPath = args[0];
      const openCsv = args[1] ?? '';
      const region = args[2] ?? 'eastasia';
      if (!spaPath) {
        throw new Error('sweep-spa requires: <spa.json> <openPrCsv> [region]');
      }
      const spa = JSON.parse(fs.readFileSync(spaPath, 'utf8')).spa ?? {};
      const uris = Array.isArray(spa.redirectUris) ? spa.redirectUris : [];
      const openPrs = openCsv
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const plan = sweepSpaPrPreviewRedirects(uris, openPrs, region);
      if (plan.remove.length === 0) {
        process.stdout.write('UNCHANGED\n');
      } else {
        process.stdout.write(JSON.stringify(plan) + '\n');
      }
      return;
    }
    default: {
      const _exhaustive = cmd;
      throw new Error(
        `usage: normalize|build|plan|sweep-spa … (got ${_exhaustive ?? 'undefined'})`,
      );
    }
  }
}

const isMain =
  Boolean(process.argv[1]) &&
  (process.argv[1].endsWith('entra-spa-preview-redirect.mjs') ||
    process.argv[1].endsWith('entra-spa-preview-redirect.js'));

if (isMain) {
  try {
    await main(process.argv.slice(2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  }
}
