#!/usr/bin/env node
/**
 * Resolve BIMI Route53 record name/value using shared @poc-plattform-kit/email helpers.
 *
 * Usage:
 *   node scripts/build-bimi-dns-record.mjs \
 *     --selector default \
 *     --sending-domain mail.example.com \
 *     --zone-domain example.com \
 *     --logo-url https://cdn.example.com/logo.svg \
 *     [--evidence-url https://cdn.example.com/vmc.pem]
 */

import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const emailEntry = pathToFileURL(join(repoRoot, 'packages/email/dist/index.js')).href;
const { resolveBimiRoute53Record } = await import(emailEntry);

function readArg(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

function main() {
  const selector = readArg('--selector');
  const sendingDomain = readArg('--sending-domain');
  const zoneDomain = readArg('--zone-domain');
  const logoUrl = readArg('--logo-url');
  const evidenceUrl = readArg('--evidence-url');

  if (!selector || !sendingDomain || !zoneDomain || !logoUrl) {
    throw new Error(
      'Usage: node scripts/build-bimi-dns-record.mjs --selector <name> --sending-domain <domain> --zone-domain <zone> --logo-url <https-url> [--evidence-url <https-url>]',
    );
  }

  const resolved = resolveBimiRoute53Record({
    selector,
    sendingDomain,
    zoneDomain,
    logoUrl,
    evidenceUrl,
  });

  process.stdout.write(`${JSON.stringify(resolved)}\n`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
