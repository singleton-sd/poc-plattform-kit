import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url));
const MIGRATION_SQL = readFileSync(
  join(PACKAGE_ROOT, 'prisma/migrations/20261114130000_lowercase_user_emails/migration.sql'),
  'utf8',
);

async function withUsers(rows, fn) {
  const db = new PGlite();
  await db.waitReady;
  await db.exec(`
    CREATE TABLE users (
      id VARCHAR(64) PRIMARY KEY,
      email VARCHAR(320) NOT NULL,
      CONSTRAINT users_email_key UNIQUE (email)
    );
  `);
  for (const row of rows) {
    await db.query('INSERT INTO users (id, email) VALUES ($1, $2)', [row.id, row.email]);
  }
  try {
    return await fn(db);
  } finally {
    await db.close();
  }
}

test('lowercase migration SQL contains a duplicate-email abort before UPDATE', () => {
  const doIndex = MIGRATION_SQL.indexOf('DO $$');
  const raiseIndex = MIGRATION_SQL.indexOf('RAISE EXCEPTION');
  const updateIndex = MIGRATION_SQL.indexOf('UPDATE users SET email = lower(email)');
  assert.ok(doIndex >= 0, 'expected a DO block');
  assert.ok(raiseIndex > doIndex, 'expected RAISE EXCEPTION inside the DO block');
  assert.ok(updateIndex > raiseIndex, 'expected UPDATE after the abort guard');
});

test('lowercase migration aborts when Agent@x.com and agent@x.com both exist', async () => {
  await withUsers(
    [
      { id: 'user-mixed', email: 'Agent@x.com' },
      { id: 'user-lower', email: 'agent@x.com' },
    ],
    async (db) => {
      await assert.rejects(
        () => db.exec(MIGRATION_SQL),
        /Cannot lowercase users\.email: case-insensitive duplicates exist \(agent@x.com\)/,
      );
      const remaining = await db.query('SELECT id, email FROM users ORDER BY id');
      assert.deepEqual(remaining.rows, [
        { id: 'user-lower', email: 'agent@x.com' },
        { id: 'user-mixed', email: 'Agent@x.com' },
      ]);
    },
  );
});

test('lowercase migration rewrites mixed-case emails when they are unique', async () => {
  await withUsers(
    [
      { id: 'user-mixed', email: 'Agent@Example.com' },
      { id: 'user-other', email: 'Other@Example.com' },
    ],
    async (db) => {
      await db.exec(MIGRATION_SQL);
      const remaining = await db.query('SELECT id, email FROM users ORDER BY id');
      assert.deepEqual(remaining.rows, [
        { id: 'user-mixed', email: 'agent@example.com' },
        { id: 'user-other', email: 'other@example.com' },
      ]);
    },
  );
});
