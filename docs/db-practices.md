# Greenfield Database Practices

Repo-adapted from the greenfield checklist (Karbon-style CodeTable / System / SharedData / tenant split). Bugbot short form: [`packages/db/.cursor/BUGBOT.md`](../packages/db/.cursor/BUGBOT.md). Locked architecture: [`AGENTS.md`](../AGENTS.md).

**One-line philosophy:** Own your data, isolate tenants, seed reference data, evolve additively, and treat anything shared across pillars as a versioned API — whether that API is HTTP, events, or a narrow SQL contract.

## Mapping to this repo

| Greenfield concept | poc-plattform-kit |
|--------------------|-------------------|
| Bounded context / service DB | **Pillar** (Tenant, SingleSignOn, Permissions, Subscriptions, Contact, Support, Audit, Reporting, Notifications) |
| One owned schema set | Models owned by one pillar under `packages/db` (PostgreSQL + Prisma `postgresql`) |
| No shared mega-schema writes | **No cross-pillar DB joins or write HTTP** |
| Cross-boundary contracts | Service Bus events, pillar HTTP APIs, read models — not raw cross-pillar SQL |
| Platform / messaging in SQL | **Per-pillar** Outbox + local Audit in the same mutation transaction |
| Single migration system | **Prisma migrate only**, forward-only |
| Secrets | Azure Key Vault (`ssd-pocpk-kv-dev-ae`); never commit values |

## Keep

### Ownership boundaries

- Prefer clearly owned table sets per pillar, not one shared write surface.
- Name models/tables so ownership is obvious (`Contact*`, `Tenant*`, …).

### Concerns by role

| Concern | Purpose here |
|---------|----------------|
| **Tenant / domain data** | Business rows scoped by `tenantId` |
| **Reference data** | Global lookups/enums, not tenant-scoped |
| **Platform / infra** | Per-pillar Outbox/Audit (and migration metadata) — not a shared outbox table |
| **Cross-boundary contracts** | Events/APIs first; SQL contracts only if justified and versioned |

Avoid a new schema per feature unless packaging/ownership truly needs it.

### Reference data

- Lookups via ref tables (`statusId` → ref), not free-text everywhere.
- Seed with idempotent upserts/MERGE (or Prisma seeders), not ad-hoc inserts in random migrations.
- Treat ref changes as versioned product changes.

### Multi-tenancy

- Every tenant-scoped table includes `tenantId` (or equivalent).
- Access paths lead with tenant + business key where helpful.
- Repositories always filter by authenticated tenant — never trust client route alone.
- Soft delete (`deletedAt` / `deletedBy`) when undelete/audit is required; filter deleted by default.

### Cross-pillar data

- Prefer APIs / events / read models over cross-DB or cross-pillar joins.
- No cross-pillar FKs; use eventual consistency, outbox, or boundary validation.
- If SQL must expose a shared read surface (rare), use a narrow versioned contract and gate changes.

### Audit columns

- Mutable business tables: `createdAt`, `updatedAt`; add `createdBy` / `updatedBy` when the product needs actor identity.
- Prefer app/session context for “who.” Local `{Pillar}Audit` rows for mutation history.

### Additive evolution

- New columns nullable or with safe defaults.
- No destructive renames/drops without expand → backfill → contract.
- Prisma migrations are the only schema history; environments apply the same ordered set.
- Identifier and reference column widths are enforced in `schema.prisma` (`@db.VarChar(n)` per ADR 0005) and in the PostgreSQL `20260828110000_init_postgresql` migration — no separate sizing migration on greenfield Postgres.

## Add (greenfield defaults)

### Single migration system

- Prisma only — no parallel hand-script track unless deliberately documented.
- Schema in git; same path for local/dev/stage/prod.
- Apply to PostgreSQL with `pwsh ./infra/migrate-db.ps1` (OIDC/CLI → Key Vault `database-url` + `database-url-unpooled` → `prisma migrate deploy`). Do not use `migrate dev` against shared deployed databases.

### Data classification

Label sensitive tables/columns (docs or comments): public / internal / confidential / secret; PII / financial / credentials. Drive retention, encryption, redaction, and backup access from that.

### Encryption and secrets

- TLS in transit; at-rest encryption (Azure SQL TDE or equivalent).
- No raw secrets/tokens in tenant tables — encrypt or store Key Vault references.
- App secrets out of the DB except where the product truly requires them.

### Strong IDs

- Opaque public IDs (`cuid` / `ulid` / `uuid`) for APIs; document generation once.
- Don’t rely on enumerable identity columns as the sole public handle.
- **Platform convention (ADR [0005](./adr/0005-entity-id-strategy.md)):** keep Prisma `@default(cuid())` for primary keys; annotate keyed/reference `String` columns with explicit native lengths instead of Prisma’s default `NVARCHAR(1000)` on SQL Server.

| Prisma role | Max length | Examples |
| --- | --- | --- |
| `EntityId` | 64 | `id`, `tenantId`, `userId`, `entityId`, `actorId`, `claimId`, seed `seed-*` fixtures, `randomUUID()` audit/outbox rows |
| `EntraOid` | 36 | `entraOid`, `requesterEntraOid` |
| `Email` | 320 | `email` |
| `Slug` | 100 | `slug` |
| `Token` | 64 | invitation `token` (`base64url` of 32 bytes) |
| `ShortLabel` | 50 | `role`, `status`, `syncStatus`, `grantType`, `principalType` |
| `Name` | 200 | tenant/group/user `name` |
| `ActionResource` | 200 | `action`, `resource`, `eventType` |
| `EntityType` | 100 | audit `entityType` |
| `IdempotencyKey` | 200 | command idempotency keys |
| `CommandHash` | 64 | SHA-256 hex digests |
| `ConsistencyVersion` | 50 | optimistic concurrency tokens |
| `Message` | 500 | `description`, `syncError`, `failureReason`, `denyReason` |
| Unbounded text | _(none)_ | `payload`, `changes`, `settings` — leave without `@db.*` |

SQL Server: `@db.NVarChar(n)` (legacy). PostgreSQL: `@db.VarChar(n)`. SQLite previews strip `@db.*` in `generate-preview-schema.mjs`.

### Referential integrity and indexing

- Real FKs **inside** a pillar; index FK and common filter paths from day one.
- Design indexes from access patterns; ensure tenant predicates can use leading columns.
- Ban N+1 / query-in-a-loop at the data-access layer for hot paths.

### Expand / contract

1. Expand — add structures, dual-write if needed  
2. Migrate — backfill  
3. Contract — remove old paths after consumers move  

### Observability, backup, access

- Slow queries, deadlocks, migration failure alerts; correlation IDs where possible.
- Automated backups + tested restores; plan tenant export/delete early.
- Least-privilege roles: app runtime ≠ migration runner ≠ reporting reader.

### Testing

- Migration tests on empty and representative data.
- Critical paths against real SQL (or containers), not mocks only.

### Outbox

- Per-pillar outbox owned with the business write transaction.
- Do not invent a second global messaging schema in SQL beyond this pattern.

### Docs that stay true

- Bounded-context / ERD map per pillar as models land.
- How to add a lookup, tenant table, and expose data to another pillar.

## Suggested layout

```
packages/db/
  prisma/schema.prisma   # pillar-grouped domain models + per-pillar Outbox/Audit
  prisma/migrations/     # forward-only Prisma history
  # ref seeds / scripts as reference data lands
  # optional ops procedures only if needed

cross-pillar:
  APIs + events first
  SQL contracts only when justified
  no shared write tables
```

**Skip by default:** cross-pillar joins as normal integration, shared write tables, many feature schemas early, duplicating identical System tables beyond per-pillar Outbox/Audit.

**Keep by default:** tenant column + enforcement, reference data + idempotent seeds, audit + soft-delete conventions, additive migrations, explicit rare cross-boundary contracts.

## Decision cheat sheet

| Situation | Prefer |
|-----------|--------|
| Status/type/enum in UI/rules | Ref table + seed |
| Data owned by one pillar | Tables in that pillar + FKs |
| Another pillar needs that data | API, event, or projected read model |
| Reporting across pillars | Reporting / warehouse / replica |
| Must join in SQL for latency | Versioned contract + review gate (still no write joins) |
| Feature flags / messaging infra | App platform or Service Bus — not copied into every OLTP surface |
| Breaking column change | Expand → backfill → contract |
