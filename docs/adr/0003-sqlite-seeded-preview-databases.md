# 0003: SQLite-seeded ephemeral databases for API PR previews

## Status

Accepted.

## Context

Every API-affecting PR gets a live preview so a reviewer (human or bot) can
exercise the change, not just read a diff. Production and dev run Prisma's
`postgresql` provider against a shared Neon PostgreSQL database. Giving
every open PR its own throwaway copy of that same database would mean
either a shared mutable database across previews (previews corrupt each
other's data) or provisioning/tearing down a real managed instance per PR
(cost and latency).

## Decision

Every PR preview runs against an isolated, disposable **SQLite** database,
never the shared production PostgreSQL database, seeded deterministically from a
catalog of named "preview scenarios" baked into the preview container image
at build time. Production and normal local development are unaffected —
they keep Prisma's `postgresql` provider and the canonical schema unchanged.
See [`docs/preview-scenarios.md`](../preview-scenarios.md) for the full
mechanism (schema transform, scenario registry, seeding, verification).

## Alternatives considered

- **A shared preview PostgreSQL database, reset between deploys.** Rejected:
  concurrent PRs would corrupt or race each other's data, and a reset step
  is one more failure point in a PR's CI path for infrastructure this repo
  doesn't otherwise need per PR.
- **A dedicated ephemeral PostgreSQL database per PR.** Rejected on cost and
  latency: multiplying managed database instances by open-PR count
  contradicts PoC cost policy, and provisioning/tearing down real
  instances per PR is far slower than building a container image with a
  baked-in SQLite file.
- **No seeded data at all (empty preview database).** Rejected: reviewers
  and bots need representative, deterministic states (happy path, empty
  states, permission/tenant boundaries) to actually exercise a change —
  and empty-state review only catches empty-state bugs.

## Consequences

- SQLite previews **cannot** prove PostgreSQL-specific behavior: native
  `@db.*` types, collation, locking, concurrency, or performance. Any
  change relying on that still needs real PostgreSQL integration
  validation as a separate step — a preview complements automated tests,
  it never replaces PostgreSQL-specific validation.
- The canonical Prisma schema must stay representable in both providers, or
  be explicitly flagged: `packages/db/scripts/generate-preview-schema.mjs`
  fails loudly (not silently) on constructs the SQLite connector can't
  express, rather than producing a broken preview schema.
- Every feature/pillar/bug PR touching `apps/api/**`, `pillars/**`, or
  `packages/db/**` must declare which named scenario(s) it seeds (or an
  explicit "not applicable" with a reason) — enforced by
  `validate-preview-scenarios.yml`. This is a delivery requirement layered
  on top of this decision, not optional tooling.
- Preview data is always synthetic and disposable: mutations never persist
  across a container restart, and outbox rows seeded by any scenario are
  marked `synthetic: true` and never reach a real consumer (previews never
  wire a live Service Bus connection).

## References

- [`docs/preview-scenarios.md`](../preview-scenarios.md) (full mechanism)
- `AGENTS.md`'s "Preview scenario delivery standard" section (the PR requirement)
- `apps/api/Dockerfile`, `apps/api/docker-entrypoint.sh` (preview-only image
  build and runtime template copy)
- `docs/pr-pipelines.md`'s "Workflow behaviour (`preview-api.yml`)" section
