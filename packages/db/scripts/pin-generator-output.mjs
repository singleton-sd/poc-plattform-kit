#!/usr/bin/env node
// Pins (replaces or inserts) the Prisma `generator client { output = ... }`
// path in a schema file. Used by the preview Docker build to repoint the
// preview schema's client output at the deploy tree's node_modules layout
// (mirrors how apps/api/Dockerfile already pins the SQL Server client's
// output for the production/App Service deploy tree).
//
// Usage: node scripts/pin-generator-output.mjs <schemaPath> <outputPath>

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function pinGeneratorOutput(schemaText, outputPath) {
  const generatorMatch = schemaText.match(/generator\s+\w+\s*\{[^}]*\}/);
  if (!generatorMatch) {
    throw new Error('No generator block found in schema.');
  }
  const generatorBlock = generatorMatch[0];
  const pinned = /output\s*=/.test(generatorBlock)
    ? generatorBlock.replace(/output\s*=\s*"[^"]*"/, `output   = "${outputPath}"`)
    : generatorBlock.replace(
        /(provider\s*=\s*"prisma-client-js")/,
        `$1\n  output   = "${outputPath}"`,
      );
  return schemaText.replace(generatorBlock, pinned);
}

function main() {
  const [, , schemaPath, outputPath] = process.argv;
  if (!schemaPath || !outputPath) {
    console.error('Usage: node scripts/pin-generator-output.mjs <schemaPath> <outputPath>');
    process.exitCode = 1;
    return;
  }
  const schemaText = readFileSync(schemaPath, 'utf8');
  const pinned = pinGeneratorOutput(schemaText, outputPath);
  writeFileSync(schemaPath, pinned);
  console.log(`Pinned generator output in ${schemaPath} -> ${outputPath}`);
}

const isCliInvocation = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isCliInvocation) {
  main();
}
