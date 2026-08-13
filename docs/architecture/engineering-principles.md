# Engineering principles

Cross-cutting rules that constrain a change regardless of which pillar or
layer it touches. These are consolidated from conventions already stated
(in more detail, with their exact commands/config) across `AGENTS.md` and
individual `docs/**` topic files — this page is the "rules of the road"
summary an implementation agent can scan quickly; follow the linked doc for
the exact mechanism.

## Pillar boundaries are load-bearing

No cross-pillar DB joins, no cross-pillar write HTTP calls. A pillar owns
its tables exclusively; cross-pillar effects go through events (Service Bus
topics) or explicit commands (queues), never a shared write surface. See
[ADR 0001](../adr/0001-pillar-isolation-and-event-driven-integration.md)
and [`docs/db-practices.md`](../db-practices.md).

## Mutations write local Audit + Outbox in the same transaction

Every domain mutation that other pillars might need to react to writes its
entity, a local `{Pillar}Audit` row, and (when something else must be
notified) a local `{Pillar}Outbox` row in one database transaction. Never a
separate, unguarded write for the audit/outbox half. See
[`docs/db-practices.md`](../db-practices.md) § Audit columns / Outbox.

## Migrations are forward-only and additive

Prisma migrations are the only schema history; no destructive rename/drop
without an expand → backfill → contract sequence across multiple releases.
New columns are nullable or defaulted so old and new code can coexist
during a rollout. See [`docs/db-practices.md`](../db-practices.md) §
Additive evolution / Expand-contract.

## Secrets live in Key Vault only

Passwords, connection strings, deploy tokens, and provider API keys live in
Azure Key Vault (`ssd-pocpk-kv-dev-ae`) and are referenced — never inlined —
from Azure App Configuration or GitHub Actions. GitHub Actions authenticates
via OIDC (repository **Variables**, not **Secrets**) and fetches secrets at
job runtime. Never commit a secret value, and never paste one into ClickUp,
a PR, or a commit. See `AGENTS.md` § Secrets + configuration and
`infra/README.md` § Secrets & config surfaces.

## Cheapest working SKU, CAF naming for anything new

Infrastructure choices default to the cheapest SKU that still satisfies the
requirement (e.g. SQL Basic, App Service B1 only because custom-domain
HTTPS + always-on need it, SWA Free, Container Apps Consumption for
anything that can scale to zero). New Azure resources follow CAF naming
(`ssd-pocpk-{resource}-dev-ae`); existing pre-CAF resource names are kept as
legacy aliases rather than renamed (renaming several of them would recreate
the resource). See `infra/README.md` § Locked constraints.

## Fine-grained authorization is centralized, not reimplemented per pillar

Any endpoint that needs per-resource authorization (not just "is this role
present") calls the Permissions pillar's `Check(subject, action, resource)`
rather than hand-rolling a check inline. See
[ADR 0002](../adr/0002-openfga-fine-grained-authorization.md) and
[`docs/permissions.md`](../permissions.md).

## Public repository, private ClickUp — pick the right side of the line

This repository is public. Secrets, customer-identifying data, contracts,
pricing/commercial terms, and sensitive roadmap never go into a GitHub
issue, PR, commit, or repository doc — that content stays in ClickUp, in
generic-enough language on the GitHub side to describe the engineering work
without it. See
[`docs/github-source-of-truth.md`](../github-source-of-truth.md) §7 for the
exact boundary and examples.

## Tests come first for behavior changes, and preview scenarios complement them

Write a failing test before changing behavior. For anything touching
`apps/api/**`, `pillars/**`, or `packages/db/**`, also declare which preview
scenario(s) the PR seeds (or that none apply and why) — a preview scenario
demonstrates a state to a reviewer, it never substitutes for a unit,
integration, or contract test. See
[`docs/development/testing-strategy.md`](../development/testing-strategy.md)
for the full picture across test types.

## One authoritative location per concept

When documenting something, extend the existing doc that already owns the
concept rather than starting a second one that will drift. If two docs
already say the same thing, that's a bug — consolidate into one and link
from the other, don't maintain both. This applies to code too: a
capability that already has a home (a pillar, a shared package) gets
extended there, not duplicated in a second place because that was locally
easier.
