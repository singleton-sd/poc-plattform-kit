# Greenfield DB practices (Bugbot)

Fuller mirror: [`docs/db-practices.md`](../../../docs/db-practices.md). Repo architecture: `AGENTS.md`.

**Philosophy:** Own your data, isolate tenants, seed reference data, evolve additively, and treat anything shared across pillars as a versioned API (HTTP, events, or a narrow SQL contract).

Pillars = bounded contexts: Tenant, SingleSignOn, Permissions, Subscriptions, Contact, Support, Audit, Reporting, Notifications. Stack: PostgreSQL + Prisma `postgresql` in `packages/db`.

## Hard rules (flag violations)

| Rule | Expect |
|------|--------|
| Ownership | One pillar owns its tables; no shared write tables across pillars |
| No cross-pillar SQL | No joins, FKs, or transactions spanning pillar tables |
| Integration | APIs / Service Bus events / read models — not cross-pillar joins |
| Mutations | Same transaction: entity + **local** Audit + **local** Outbox when notifying |
| Outbox / Audit | Per-pillar tables only (`{Pillar}Outbox`, `{Pillar}Audit`) — never a shared mega-table |
| Tenancy | Tenant-scoped tables have `tenantId`; queries always filter authenticated tenant |
| Migrations | Prisma only, **forward-only**; expand → backfill → contract; no big-bang drops/renames |
| Secrets | Key Vault / refs only — never raw tokens in rows or committed config |
| AuthZ data | Permissions/OpenFGA owns fine-grained authZ; other pillars do not embed authZ rules in SQL |

## Review checklist

- [ ] Schema change owned by one pillar; folder/model naming makes ownership obvious
- [ ] Reference/lookup data in `ref`-style models + idempotent seeds — not free-text enums in tenant rows
- [ ] Mutable business tables: `createdAt` / `updatedAt` (+ actor fields when product needs them); soft-delete only if product requires undelete
- [ ] Real FKs **inside** a pillar; no cross-pillar FKs
- [ ] Indexes from access patterns; tenant predicate can use leading index column
- [ ] Public IDs opaque (`cuid`/`ulid`/`uuid`); don’t expose enumerable internals as sole API keys
- [ ] Data classification noted for PII/secret columns (docs or comments) when adding sensitive fields
- [ ] Least-privilege implied (app ≠ migrator ≠ reporting); no secrets in Prisma schema comments beyond names
- [ ] Critical paths: prefer real SQL tests over mocks only

## Decision cheat sheet

| Situation | Prefer |
|-----------|--------|
| Status/type/enum in UI/rules | Ref table + idempotent seed |
| Data owned by one pillar | Tables + FKs in that pillar |
| Another pillar needs data | API, event, or projected read model |
| Reporting across pillars | Reporting pillar / replica / curated read — not OLTP joins |
| Must share in SQL (rare) | Versioned contract surface + explicit review — still no write joins |
| Breaking column change | Expand → backfill → contract |
| Messaging / outbox | Per-pillar outbox in same write transaction |

## Layout (pragmatic)

```
packages/db/prisma/   # single Prisma schema + forward migrations
  # models grouped by pillar (domain)
  # ref/lookup models + seed scripts as they land
  # per-pillar Outbox + Audit (platform pattern, not shared tables)
```

Skip by default: cross-pillar joins, shared write tables, duplicating identical “System” infra tables beyond the per-pillar Outbox/Audit pattern, many schemas per feature early on.
