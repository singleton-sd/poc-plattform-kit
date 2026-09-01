#!/usr/bin/env node
// Derives a SQLite-compatible preview Prisma schema from the canonical
// PostgreSQL schema. Production and normal builds keep using
// prisma/schema.prisma untouched; this script only produces the generated,
// gitignored prisma/schema.preview.prisma consumed by preview image builds
// and local preview/scenario tooling (see AGENTS.md "PoC preview scenarios").
//
// Usage:
//   node scripts/generate-preview-schema.mjs [schemaPath] [outPath]
//
// Exits non-zero with an actionable diagnostic per incompatible construct
// when the canonical schema uses something the SQLite connector cannot
// represent, instead of silently producing a broken preview schema.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const PREVIEW_GENERATOR_OUTPUT = './generated/preview-client';
const CANONICAL_PROVIDER = 'postgresql';
const PREVIEW_PROVIDER = 'sqlite';

/**
 * Constructs the SQLite connector cannot represent. Each entry is a regex
 * matched against the raw schema text (comments are stripped first) plus a
 * human-readable explanation used in the diagnostic.
 *
 * `@db.*` native types are allowed on the canonical schema (ADR 0005) and are
 * stripped when producing the SQLite preview schema.
 */
const INCOMPATIBLE_CONSTRUCTS = [
  {
    pattern: /@@schema\(/g,
    describe: () =>
      `multi-schema attribute "@@schema(...)" is not supported by the SQLite connector`,
  },
  {
    pattern: /\bUnsupported\(/g,
    describe: () => `Unsupported(...) field types have no SQLite equivalent`,
  },
  {
    pattern: /^\s*enum\s+\w+\s*\{/gm,
    describe: (match) =>
      `"${match.trim()}" — enum declarations are not portable to the SQLite connector`,
  },
];

/** Strips `//` line comments and `/* ... *\/` block comments before scanning. */
function stripComments(schemaText) {
  return schemaText.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

function findDatasourceBlock(schemaText) {
  const match = schemaText.match(/datasource\s+\w+\s*\{[^}]*\}/);
  if (!match) {
    throw new SchemaDiagnosticError([
      { rule: 'datasource-missing', message: 'No datasource block found in schema.' },
    ]);
  }
  return match[0];
}

export class SchemaDiagnosticError extends Error {
  constructor(diagnostics) {
    super(
      `Canonical schema is not SQLite-preview compatible:\n${diagnostics
        .map((d) => `  - ${d.message}`)
        .join('\n')}`,
    );
    this.name = 'SchemaDiagnosticError';
    this.diagnostics = diagnostics;
  }
}

/**
 * Scans the canonical schema for constructs the SQLite connector cannot
 * represent. Returns an array of diagnostics (empty when compatible).
 */
export function validateSqliteCompatibility(schemaText) {
  const scanned = stripComments(schemaText);
  const diagnostics = [];

  for (const { pattern, describe } of INCOMPATIBLE_CONSTRUCTS) {
    for (const match of scanned.matchAll(pattern)) {
      const line = scanned.slice(0, match.index).split('\n').length;
      diagnostics.push({
        rule: pattern.source,
        message: `line ${line}: ${describe(match[0])}`,
      });
    }
  }

  const datasourceBlock = findDatasourceBlock(scanned);
  if (!new RegExp(`provider\\s*=\\s*"${CANONICAL_PROVIDER}"`).test(datasourceBlock)) {
    diagnostics.push({
      rule: 'datasource-provider',
      message: `datasource provider must be "${CANONICAL_PROVIDER}" in the canonical schema (found something else) — the preview transform only knows how to map from ${CANONICAL_PROVIDER}`,
    });
  }

  return diagnostics;
}

/** Removes provider-native `@db.*` attributes — SQLite uses plain `String`. */
export function stripNativeDbAttributes(schemaText) {
  return schemaText.replace(/\s+@db\.\w+(?:\([^)]*\))?/g, '');
}

/**
 * Produces the SQLite preview schema text. Throws SchemaDiagnosticError when
 * the canonical schema is incompatible — callers must run
 * validateSqliteCompatibility (or catch this) before writing output.
 */
export function transformToSqlitePreviewSchema(schemaText) {
  const diagnostics = validateSqliteCompatibility(schemaText);
  if (diagnostics.length > 0) {
    throw new SchemaDiagnosticError(diagnostics);
  }

  let preview = stripNativeDbAttributes(schemaText);

  const datasourceBlock = findDatasourceBlock(preview);
  const previewDatasourceBlock = datasourceBlock
    .replace(/provider\s*=\s*"postgresql"/, `provider = "${PREVIEW_PROVIDER}"`)
    .replace(/\n\s*directUrl\s*=\s*env\("[^"]+"\)\s*/g, '\n');

  preview = preview.replace(datasourceBlock, previewDatasourceBlock);

  const generatorMatch = preview.match(/generator\s+\w+\s*\{[^}]*\}/);
  if (!generatorMatch) {
    throw new SchemaDiagnosticError([
      { rule: 'generator-missing', message: 'No generator block found in schema.' },
    ]);
  }
  const generatorBlock = generatorMatch[0];
  const previewGeneratorBlock = /output\s*=/.test(generatorBlock)
    ? generatorBlock.replace(/output\s*=\s*"[^"]*"/, `output   = "${PREVIEW_GENERATOR_OUTPUT}"`)
    : generatorBlock.replace(
        /(provider\s*=\s*"prisma-client-js")/,
        `$1\n  output   = "${PREVIEW_GENERATOR_OUTPUT}"`,
      );
  preview = preview.replace(generatorBlock, previewGeneratorBlock);

  const header =
    '// GENERATED FILE — do not edit by hand.\n' +
    '// Produced by scripts/generate-preview-schema.mjs from prisma/schema.prisma\n' +
    '// for ephemeral PR preview / local scenario testing only. Production and\n' +
    '// normal builds keep using the canonical PostgreSQL schema.\n\n';

  return header + preview;
}

function main() {
  const [, , schemaPathArg, outPathArg] = process.argv;
  const schemaPath = schemaPathArg ?? 'prisma/schema.prisma';
  const outPath = outPathArg ?? 'prisma/schema.preview.prisma';

  const schemaText = readFileSync(schemaPath, 'utf8');

  try {
    const preview = transformToSqlitePreviewSchema(schemaText);
    writeFileSync(outPath, preview);
    console.log(`Wrote SQLite preview schema: ${outPath}`);
  } catch (error) {
    if (error instanceof SchemaDiagnosticError) {
      console.error(error.message);
      process.exitCode = 1;
      return;
    }
    throw error;
  }
}

const isCliInvocation = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isCliInvocation) {
  main();
}
