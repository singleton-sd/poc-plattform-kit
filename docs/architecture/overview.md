# Architecture overview

This is the narrative entry point into the platform's technical
architecture — what the system is made of, how the pieces talk to each
other, and where to go for the detail on any one piece. It exists so an
implementation agent (or a new engineer) can get oriented without opening
ClickUp; per
[`docs/github-source-of-truth.md`](../github-source-of-truth.md) section 1,
repository documentation, not ClickUp, is now the authoritative store for
this kind of technical knowledge. For the full list of what else exists
under `docs/**`, see [`docs/README.md`](../README.md).

This is a synthesis document — it deliberately does not repeat detail that
already lives in a linked topic doc. When something here and a linked doc
disagree, the linked topic doc wins (fix this page, don't fork the detail).

## System shape

Nine bounded contexts ("pillars"), each Nest-module-shaped, each owning an
exclusive slice of the schema in `packages/db`, communicating with each
other only through HTTP reads and asynchronous events — never a cross-pillar
SQL join or a cross-pillar write HTTP call. See
[ADR 0001](../adr/0001-pillar-isolation-and-event-driven-integration.md) for
why, and [`docs/db-practices.md`](../db-practices.md) for the data-ownership
rules that follow from it.

| Pillar | Owns | Status in this repo |
| --- | --- | --- |
| **Tenant** | Tenants, tenancy boundaries, per-tenant membership | Implemented (`pillars/tenant`) |
| **SingleSignOn** | Entra AuthN, Auth.js session cookies, coarse roles | Implemented (no dedicated pillar package yet — lives in `apps/api` auth wiring; see `docs/sso.md`) |
| **Permissions** | Fine-grained AuthZ (`Check(subject, action, resource)`) via OpenFGA | Implemented (`pillars/permissions`) |
| **Subscriptions** | Tenant plans/entitlements | Outbox/Audit scaffold only so far |
| **Contact** | Public brochure-site contact intake | Outbox/Audit scaffold; edge HTTP handled separately (see Marketing edge below) |
| **Support** | Support tickets, diagnostics, impersonation | Outbox/Audit scaffold; see `docs/discovery/*` for the in-progress design |
| **Audit** | Platform-wide durable audit trail from every pillar's events | Implemented (`pillars/audit`) |
| **Reporting** | Cross-pillar read models / projections built from events | Implemented (`pillars/reporting`) |
| **Notifications** | Outbound email/SMS/WhatsApp orchestration | Implemented (`pillars/notifications`) |

"Scaffold only" means the pillar package exists with its Outbox/Audit
tables wired (so it can already safely participate in the event mesh) but
has no domain entities/endpoints yet — check `pillars/<name>/README.md` and
`packages/db/prisma/schema.prisma` for current ground truth, since this
changes as feature work lands.

## How pillars talk to each other

- **Synchronous reads**, when one pillar genuinely needs another pillar's
  data or a decision (e.g. `Check()` calls to Permissions): plain HTTP.
- **Cross-pillar writes**: never synchronous, never direct. A mutation
  writes its entity + a local `{Pillar}Audit` row + a local `{Pillar}Outbox`
  row in one DB transaction; a drainer publishes the outbox row to that
  pillar's Azure Service Bus **topic** (`{pillar}.events`) after commit.
  Interested pillars subscribe. One-off commands (not broadcast events) use
  Service Bus **queues** instead (e.g. `notifications.send`).
- Current topic/queue and subscription wiring lives in `infra/README.md`
  (Service Bus topics/queues section) and `infra/servicebus-subscriptions
  .bicep` — that's the ground truth for "who currently consumes what,"
  since it changes as pillars gain consumers.

## Multitenancy

- Every tenant-scoped table carries a `tenantId`; repositories always filter
  by the authenticated tenant, never trust a client-supplied value alone —
  see [`docs/db-practices.md`](../db-practices.md)'s "Multi-tenancy" section.
- The tenant id for a request is resolved from, in order: an optional
  `tenant_id` claim on the Auth.js session / Entra JWT, then a legacy/dev
  `x-tenant-id` header when that claim is absent. A verified JWT claim
  always overrides a client-forged header once authentication has run. See
  [`docs/sso.md`](../sso.md)'s "Tenancy" section and `pillars/tenant/README.md`.
- Entra's own directory tenant id (`tid`) is a different concept from this
  platform's `Tenant.id` — never conflate the two.
- Tenant membership/roles (`TenantMembership`) are identity/membership
  bookkeeping only; they don't enforce anything by themselves — enforcement
  of "can this member do this" is the Permissions pillar's job (fine-
  grained AuthZ, next section), not a join against `TenantMembership`.

## AuthN / AuthZ

Two distinct layers, kept deliberately separate — see
[ADR 0002](../adr/0002-openfga-fine-grained-authorization.md) for why they
aren't merged into one system:

| Layer | Mechanism | Doc |
| --- | --- | --- |
| AuthN + coarse roles | Entra ID via Auth.js (cookies) or Bearer JWT; Nest `APP_GUARD` + `@Roles(...)` | [`docs/sso.md`](../sso.md) |
| Fine-grained AuthZ | Permissions pillar → OpenFGA (Zanzibar/ReBAC) `Check(subject, action, resource)` | [`docs/permissions.md`](../permissions.md), `pillars/permissions/README.md` |

Other pillars call Permissions (sync HTTP or a cache in front of it) for
protected actions; authorization rules are never hand-rolled inside a
domain pillar. `Check()` failures/unreachability fail closed (deny), never
open.

## Data and persistence

Azure SQL (Basic SKU) + Prisma with the `sqlserver` provider is the single
canonical schema for production/dev. See
[`docs/db-practices.md`](../db-practices.md) for ownership boundaries,
reference-data conventions, additive-migration rules, and the outbox
pattern in full.

API PR previews are the one deliberate exception: they run against an
isolated, disposable **SQLite** database seeded from named scenarios,
never the shared Azure SQL database — see
[ADR 0003](../adr/0003-sqlite-seeded-preview-databases.md) and
[`docs/preview-scenarios.md`](../preview-scenarios.md) for the full
mechanism, and [`docs/development/testing-strategy.md`](../development/testing-strategy.md)
for how this fits into the overall testing picture.

## HTTP contract and generated clients

Nest Swagger is the contract of record; no consumer hand-writes request/
response types against the API. `pnpm openapi:export` → committed
`packages/api-client/openapi.json` → `pnpm openapi:generate` (Orval) →
`@poc-plattform-kit/api-client`, consumed by `apps/web`. See
[`docs/openapi-client.md`](../openapi-client.md) for the full flow, and
[`docs/dto-mapping.md`](../dto-mapping.md) for how domain entities map to
DTOs.

## Frontend surfaces

| Surface | Stack | Notes |
| --- | --- | --- |
| Web app | Next.js PWA SPA + Tailwind + Singleton SD design tokens | `apps/web`; consumes the generated API client |
| Marketing | Astro SSG + Tailwind + tokens + Markdown + Decap CMS (`/admin`) | `apps/marketing`; see [`docs/marketing-astro-decap.md`](../marketing-astro-decap.md) |
| Marketing edge | Azure Function App (public anonymous HTTP: Contact form, etc.) | `apps/marketing-oauth`; deliberately **not** on Nest `apps/api` — see [`docs/marketing-edge.md`](../marketing-edge.md). Decap `/admin` GitHub login is shared [`cms-oauth-kit`](https://github.com/singleton-sd/cms-oauth-kit) (`https://auth.singletonsd.com`), not this Function. |

## Deployment topology

| Component | Prod/dev host | PR preview host |
| --- | --- | --- |
| Web | SWA Free (custom domain) | SWA Free PR preview (`*.azurestaticapps.net`) |
| Marketing | SWA Free (custom domain) | SWA Free PR preview |
| API | App Service B1 (custom domain) | Azure Container Apps Consumption, ephemeral, scale-to-zero |
| Marketing edge | Azure Function App B1 | — |
| OpenFGA | Azure Container Apps Consumption | shares the dev store; see ADR 0002 |

Public hostnames sit under `singletonsd.com`, with DNS in AWS Route53
pointing CNAMEs at Azure. Path-filtered GitHub Actions (OIDC → Azure, no
long-lived deploy secrets) run CI and deploy per change area. Full detail:
[`docs/pr-pipelines.md`](../pr-pipelines.md), `infra/README.md`,
[`docs/dns-route53.md`](../dns-route53.md).

## Observability

Application Insights + Log Analytics, shared across API and web, with
alerting on exception/failed-request spikes. See
[`docs/telemetry.md`](../telemetry.md).

## Cross-cutting rules that don't fit one section

See [`docs/architecture/engineering-principles.md`](./engineering-principles.md)
for the rules that apply across every pillar regardless of which one you're
touching (cost/SKU posture, secrets handling, migration discipline, and so
on) and the settled decisions in [`docs/adr/`](../adr/) for the "why" behind
the architecture choices summarized on this page.
