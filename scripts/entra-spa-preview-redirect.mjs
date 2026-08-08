#!/usr/bin/env node
/**
 * Helpers + tiny CLI for Entra SPA redirect URI updates on SWA PR previews.
 *
 * CLI:
 *   node entra-spa-preview-redirect.mjs normalize <url>
 *   node entra-spa-preview-redirect.mjs build <defaultHostname> <pr> [region]
 *   node entra-spa-preview-redirect.mjs plan add|remove <spa.json> <origin>
 *
 * `plan` prints UNCHANGED or a JSON array of redirectUris.
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
  const normalized = normalizeOrigin(origin);
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
      const next = action === 'add' ? addRedirectUri(uris, origin) : removeRedirectUri(uris, origin);
      if (JSON.stringify(next) === JSON.stringify(uris)) {
        process.stdout.write('UNCHANGED\n');
      } else {
        process.stdout.write(JSON.stringify(next) + '\n');
      }
      return;
    }
    default: {
      const _exhaustive = cmd;
      throw new Error(
        `usage: normalize|build|plan … (got ${_exhaustive ?? 'undefined'})`,
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
