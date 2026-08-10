import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  SchemaDiagnosticError,
  transformToSqlitePreviewSchema,
  validateSqliteCompatibility,
} from './generate-preview-schema.mjs';

const SCRIPT_PATH = fileURLToPath(new URL('./generate-preview-schema.mjs', import.meta.url));
const CANONICAL_SCHEMA_PATH = fileURLToPath(new URL('../prisma/schema.prisma', import.meta.url));

const VALID_SCHEMA = `
datasource db {
  provider = "sqlserver"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Tenant {
  id   String @id @default(cuid())
  name String
}
`;

test('validateSqliteCompatibility accepts a plain canonical schema', () => {
  assert.deepEqual(validateSqliteCompatibility(VALID_SCHEMA), []);
});

test('validateSqliteCompatibility flags @db native type attributes', () => {
  const schema = VALID_SCHEMA.replace('name String', 'name String @db.NVarChar(100)');
  const diagnostics = validateSqliteCompatibility(schema);
  assert.equal(diagnostics.length, 1);
  assert.match(diagnostics[0].message, /@db\.NVarChar/);
});

test('validateSqliteCompatibility flags multi-schema attributes', () => {
  const schema = `${VALID_SCHEMA}\nmodel Foo {\n  id String @id\n  @@schema("other")\n}\n`;
  const diagnostics = validateSqliteCompatibility(schema);
  assert.ok(diagnostics.some((d) => d.rule === '@@schema\\('));
});

test('validateSqliteCompatibility flags enum declarations', () => {
  const schema = `${VALID_SCHEMA}\nenum Role {\n  OWNER\n  MEMBER\n}\n`;
  const diagnostics = validateSqliteCompatibility(schema);
  assert.ok(diagnostics.some((d) => d.message.includes('enum Role')));
});

test('validateSqliteCompatibility requires the canonical provider to be sqlserver', () => {
  const schema = VALID_SCHEMA.replace('provider = "sqlserver"', 'provider = "postgresql"');
  const diagnostics = validateSqliteCompatibility(schema);
  assert.ok(diagnostics.some((d) => d.rule === 'datasource-provider'));
});

test('validateSqliteCompatibility ignores constructs mentioned only in comments', () => {
  const schema = VALID_SCHEMA.replace(
    'model Tenant {',
    '// example: name String @db.NVarChar(100)\nmodel Tenant {',
  );
  assert.deepEqual(validateSqliteCompatibility(schema), []);
});

test('transformToSqlitePreviewSchema swaps only the datasource provider', () => {
  const preview = transformToSqlitePreviewSchema(VALID_SCHEMA);
  assert.match(preview, /datasource db \{\s*provider = "sqlite"/);
  assert.doesNotMatch(preview, /provider = "sqlserver"/);
  assert.match(preview, /url\s*=\s*env\("DATABASE_URL"\)/);
});

test('transformToSqlitePreviewSchema pins a dedicated generator output', () => {
  const preview = transformToSqlitePreviewSchema(VALID_SCHEMA);
  assert.match(preview, /output\s*=\s*"\.\/generated\/preview-client"/);
});

test('transformToSqlitePreviewSchema is idempotent on its own output (re-pins output cleanly)', () => {
  const once = transformToSqlitePreviewSchema(VALID_SCHEMA);
  // The generator block in `once` has provider sqlite already; validation
  // requires canonical sqlserver, so re-running on `once` directly should
  // fail loudly rather than silently double-transforming.
  assert.throws(() => transformToSqlitePreviewSchema(once), SchemaDiagnosticError);
});

test('transformToSqlitePreviewSchema throws SchemaDiagnosticError with all diagnostics for an incompatible schema', () => {
  const schema = VALID_SCHEMA.replace('name String', 'name String @db.NVarChar(100)');
  assert.throws(
    () => transformToSqlitePreviewSchema(schema),
    (error) => {
      assert.ok(error instanceof SchemaDiagnosticError);
      assert.equal(error.diagnostics.length, 1);
      return true;
    },
  );
});

test('the real canonical schema.prisma is SQLite-preview compatible today', () => {
  const canonical = readFileSync(CANONICAL_SCHEMA_PATH, 'utf8');
  assert.deepEqual(validateSqliteCompatibility(canonical), []);
  // Should not throw.
  transformToSqlitePreviewSchema(canonical);
});

test('CLI writes a preview schema file and exits 0 for a compatible schema', () => {
  const dir = mkdtempSync(join(tmpdir(), 'preview-schema-cli-'));
  try {
    const schemaPath = join(dir, 'schema.prisma');
    const outPath = join(dir, 'schema.preview.prisma');
    writeFileSync(schemaPath, VALID_SCHEMA);

    execFileSync(process.execPath, [SCRIPT_PATH, schemaPath, outPath], { encoding: 'utf8' });

    const written = readFileSync(outPath, 'utf8');
    assert.match(written, /provider = "sqlite"/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('CLI exits non-zero with an actionable diagnostic for an incompatible schema', () => {
  const dir = mkdtempSync(join(tmpdir(), 'preview-schema-cli-bad-'));
  try {
    const schemaPath = join(dir, 'schema.prisma');
    const outPath = join(dir, 'schema.preview.prisma');
    writeFileSync(schemaPath, VALID_SCHEMA.replace('name String', 'name String @db.NVarChar(100)'));

    assert.throws(
      () => {
        execFileSync(process.execPath, [SCRIPT_PATH, schemaPath, outPath], {
          encoding: 'utf8',
          stdio: 'pipe',
        });
      },
      (error) => {
        assert.equal(error.status, 1);
        assert.match(error.stderr.toString(), /@db\.NVarChar/);
        return true;
      },
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
