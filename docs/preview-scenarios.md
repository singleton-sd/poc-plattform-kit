# Preview scenarios

`[repo=singleton-sd/poc-plattform-kit]`

Ephemeral PR previews are the primary low-effort environment for product
acceptance testing and demonstrations. Every API PR preview runs against an
isolated, disposable **SQLite** database — never the shared Azure SQL
database — seeded deterministically from a catalog of named **preview
scenarios**. Production and normal local builds are unaffected: they keep
using Prisma's `sqlserver` provider and the canonical schema.

This document covers the SQLite preview foundation and the scenario
framework (packages/db). Preview deployment wiring (per-PR seeding, the PR
comment, readiness checks) is documented in
[`docs/pr-pipelines.md`](./pr-pipelines.md); the delivery requirement for
feature/bug work is documented in [`AGENTS.md`](../AGENTS.md).

## Why SQLite only for previews

- Prisma cannot switch one generated client between SQL Server and SQLite at
  runtime — the provider is baked in at `prisma generate` time.
- `apps/api/Dockerfile` (used **only** by `preview-api.yml`, never by
  production App Service deploys) derives a SQLite-compatible schema from
  the canonical `packages/db/prisma/schema.prisma` at build time, generates
  a SQLite Prisma client from it, and bakes an **immutable** SQLite database
  template into the image via `prisma db push`.
- `apps/api/docker-entrypoint.sh` copies that read-only template to a
  writable runtime path on every container start, so a preview always
  starts from the same deterministic seeded state and mutations never
  persist across restarts/redeploys.
- The image never resolves the shared `secret:database-url` — its
  `DATABASE_URL` is explicit and SQLite-only, which
  `apps/api/src/config/app-configuration.ts` cannot override (explicit
  environment variables always win over App Configuration).

**What SQLite previews cannot prove:** SQL Server-specific migration,
locking, collation, concurrency, or performance behaviour. Changes relying
on SQL Server-specific behaviour (native types, raw SQL, provider-specific
migrations) still need SQL Server integration validation — a preview is a
complement to automated tests, never a replacement.

## The schema transform

`packages/db/scripts/generate-preview-schema.mjs` derives
`prisma/schema.preview.prisma` (generated, gitignored — never commit it)
from the canonical schema by swapping only the datasource provider and
pinning a dedicated generator output. It first validates the canonical
schema for constructs the SQLite connector can't represent (native `@db.`
types, `@@schema(...)`, `Unsupported(...)`, `enum` declarations) and fails
loudly with an actionable diagnostic instead of silently producing a broken
preview schema:

```bash
pnpm --filter @poc-plattform-kit/db run preview:schema   # writes prisma/schema.preview.prisma
pnpm --filter @poc-plattform-kit/db run preview:generate # generates the SQLite client
pnpm --filter @poc-plattform-kit/db run preview:push     # DATABASE_URL=file:... prisma db push
```

`packages/db/scripts/pin-generator-output.mjs` is a small standalone helper
(used by the Dockerfile) that repoints a schema's `generator client {
output = ... }` at a different path — used to match the deployed tree's
`node_modules` layout, the same way the Dockerfile already does for the
production SQL Server client.

## The scenario catalog

`packages/db/scripts/scenarios/` implements a provider-neutral scenario
registry:

- **`registry.mjs`** — `createScenarioRegistry()` lets you `define()`
  named scenarios with `dependsOn` / `conflictsWith`, and `resolve(names)`
  into a deterministic, dependency-ordered, deduplicated list. Unknown
  names, dependency cycles, and declared conflicts all fail with an
  actionable error (`UnknownScenarioError` lists every supported name).
- **`catalog.mjs`** — `createCatalog()` builds the actual catalog used by
  previews: every `pillar/tenant/*` scenario, one `pillar/<pillar>/
  outbox-safe` scenario per pillar that only has an Outbox/Audit scaffold
  so far (no invented product behaviour), and the `demo` baseline that
  composes a representative set of them.
- **`seed-runner.mjs`** — runs `seed(prisma)` then `verify(prisma)` for a
  resolved scenario list against any Prisma client (SQLite preview or, in
  principle, SQL Server) — seeding only ever uses standard Prisma Client
  APIs (`upsert`, `create`, `update`, `count`, `findMany`), never
  provider-specific SQL.
- **`scripts/seed.mjs`** — the CLI entry point:

  ```bash
  node scripts/seed.mjs --list
  node scripts/seed.mjs --scenarios=demo \
    --database-url=file:./prisma/preview.db \
    --client=./prisma/generated/preview-client
  PREVIEW_SEED_SCENARIOS=pillar/tenant/owner node scripts/seed.mjs \
    --database-url=file:./prisma/preview.db --client=./prisma/generated/preview-client
  ```

  `PREVIEW_SEED_SCENARIOS` (comma-separated) selects scenarios when
  `--scenarios` isn't passed; both default to `demo` when unset. Prefer
  **absolute** `--database-url` file paths — Prisma resolves a relative
  `file:` URL relative to the schema file's directory, not your shell's
  working directory, which is easy to get wrong.

### Naming convention

| Prefix | Use for |
| --- | --- |
| `pillar/<pillar>/<scenario>` | A platform pillar's representative states |
| `feature/<slug>/<scenario>` | A specific feature's acceptance states |
| `bug/<ticket-id>/<scenario>` | A minimal regression fixture for a data-dependent bug |

### Determinism and idempotency

Every seeded row uses an **explicit, deterministic id** (e.g.
`seed-tenant-acme-rocketry`, `seed-owner-membership`) and every write is an
`upsert` keyed by that id. Running the same scenario set twice produces the
same logical dataset — no duplicate rows, no unique-constraint errors. Audit
timeline entries use fixed synthetic offsets from `timestamps.mjs`
(`SEED_EPOCH`), not `Date.now()`, so the dataset doesn't depend on when a
preview happened to be built.

### Safety

- All identities are synthetic (`*.example.invalid` emails, `seed-*` ids) —
  never real customer data, credentials, or production addresses.
- Outbox rows seeded by any scenario are marked `synthetic: true` in their
  payload and are never at risk of reaching a real consumer: previews never
  set `AZURE_SERVICEBUS_CONNECTION_STRING`, so `OutboxDrainerService` stays
  disabled regardless of what's seeded (see `docs/pr-pipelines.md` for how
  the preview workflow enforces this).

### Adding a scenario

1. Pick a name following the convention above.
2. Add a fixture module (or extend an existing one) under
   `packages/db/scripts/scenarios/fixtures/`, exporting a
   `registerXScenarios(registry)` function that calls `registry.define({
   name, description, dependsOn, seed, verify, testInstructions })`.
3. Register it from `catalog.mjs`.
4. Add it to `demo`'s `dependsOn` only if it belongs in the default
   baseline — keep scenarios small and composable rather than growing one
   giant global seed.
5. Add unit tests for anything registry-level, and let the existing
   `catalog.integration.test.mjs` pattern (real SQLite db, seed, verify,
   re-seed for idempotency) cover the new fixture, or add a focused
   integration test alongside it.

### Testing

```bash
pnpm --filter @poc-plattform-kit/db test
```

Runs `prisma validate` plus every `*.test.mjs` under `packages/db/scripts`
and `packages/db/scripts/scenarios` — unit tests for the registry/catalog
plus integration tests that build a real temporary SQLite database (mirrors
what the preview Docker image does) and seed/verify/re-seed it.
