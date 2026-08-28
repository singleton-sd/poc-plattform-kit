# 0005: Entity ID strategy and relational column sizing

## Status

Accepted.

## Context

Platform Kit persists most entity primary keys as application-generated strings
(`String @id @default(cuid())` in Prisma). Preview seed data and some services
also use deterministic `seed-*` identifiers or `crypto.randomUUID()` (36
characters). Prisma's default SQL Server mapping for `String` columns is
`NVARCHAR(1000)`, including clustered primary keys and foreign-key columns.
That width is far larger than the identifiers we actually store, which
inflates index key size, storage, and memory for little benefit.

Issue [#256](https://github.com/singleton-sd/poc-plattform-kit/issues/256)
investigated whether the **algorithm** (CUID vs UUIDv7 vs ULID vs Snowflake)
should change. The conclusion: **keep CUID** as the default Prisma
`@default(cuid())` for new rows; the main fix is **explicit, right-sized column
annotations** and documenting how non-CUID identifiers (seed fixtures, UUID
audit/outbox rows) fit the same `EntityId` width.

PostgreSQL migration ([#290](https://github.com/singleton-sd/poc-plattform-kit/issues/290))
will map the same Prisma annotations to `@db.VarChar(n)` on the new provider.

## Decision

1. **Keep CUID** (`@default(cuid())`) for schema-defined primary keys unless a
   ticket explicitly chooses a natural/composite key.
2. **Standardise explicit native lengths** on canonical string columns via
   Prisma `@db.NVarChar(n)` (SQL Server today; `@db.VarChar(n)` after the
   PostgreSQL provider switch). See [`docs/db-practices.md`](../db-practices.md)
   for the length table.
3. **Leave unbounded JSON/text** (`payload`, `changes`, `settings`) without a
   native length attribute so they remain `NVARCHAR(MAX)` / PostgreSQL `TEXT`.
4. **SQLite PR previews** strip `@db.*` attributes when generating
   `schema.preview.prisma` — SQLite previews validate application behaviour,
   not provider-native width enforcement.

## Alternatives considered

- **Replace CUID with UUIDv7 / ULID for index locality.** Rejected for now:
  CUID already satisfies distributed application-side generation; changing the
  algorithm would touch APIs, events, seeds, and existing rows without solving
  the observed `NVARCHAR(1000)` waste on its own.
- **Snowflake-style 64-bit numeric IDs.** Rejected: JavaScript safe-integer and
  JSON string-representation ergonomics add contract complexity without a
  demonstrated need.
- **Do nothing until PostgreSQL migration.** Rejected: right-sizing columns is
  independent of provider and reduces cost on Azure SQL during the remaining
  cutover window.

## Consequences

- New migrations must use the documented lengths; do not rely on Prisma's
  default `NVARCHAR(1000)` for keyed `String` columns.
- Preview schema generation strips `@db.*` — native widths are enforced in
  deployed SQL Server/PostgreSQL only.
- Seed IDs (`seed-*`, up to 64 chars) and `randomUUID()` outbox/audit rows (36
  chars) fit within `EntityId` (`NVarChar(64)`).
- Invitation tokens (`randomBytes(32).base64url`, 43 chars) fit `Token`
  (`NVarChar(64)`).

## References

- [`packages/db/prisma/schema.prisma`](../../packages/db/prisma/schema.prisma)
- [`docs/db-practices.md`](../db-practices.md) — identifier length table
- [#256](https://github.com/singleton-sd/poc-plattform-kit/issues/256)
- [#288](https://github.com/singleton-sd/poc-plattform-kit/issues/288) —
  PostgreSQL migration epic
