# 0001: Pillar isolation with event-driven cross-pillar integration

## Status

Accepted.

## Context

The platform is organized into nine bounded contexts ("pillars": Tenant,
SingleSignOn, Subscriptions, Contact, Support, Audit, Reporting, Permissions,
Notifications), each with its own Prisma-owned table set under
`packages/db`. Multiple pillars often need to react to the same business
fact — e.g. a new tenant needs an Audit trail entry, may need a Reporting
projection, and may need a welcome Notification.

The naive way to satisfy that is a direct cross-pillar SQL join or a
synchronous cross-pillar write call ("Contact just calls into Tenant's
tables directly since it's all one database anyway"). That keeps working
right up until two pillars need independently deployable schemas, until one
pillar's mutation has to fan out to several consumers, or until one
consumer pillar is temporarily unavailable and a synchronous write path
would then block or fail the request that has nothing to do with it.

## Decision

No cross-pillar DB joins and no cross-pillar write HTTP calls. A pillar owns
its own tables exclusively. When another pillar must be notified of a
mutation, the owning pillar writes the domain entity, a local
`{Pillar}Audit` row, and a local `{Pillar}Outbox` row in the **same
database transaction**, then a drainer publishes the outbox row to an Azure
Service Bus **topic** (`{pillar}.events`) after commit. Interested pillars
subscribe to that topic. Explicit one-off commands (not broadcast events)
go on Service Bus **queues** instead (e.g. `notifications.send`).

Read-only cross-pillar access, when genuinely needed, goes through a
pillar's HTTP API or a projected read model — never a live cross-pillar SQL
join.

## Alternatives considered

- **Shared database / cross-pillar joins.** Rejected: couples pillar
  deploys and schemas, makes ownership ambiguous, and defeats the point of
  drawing pillar boundaries at all.
- **Synchronous cross-pillar HTTP writes** (Contact calls Tenant's API to
  write into Tenant's own tables on Contact's behalf, or vice versa).
  Rejected: makes the initiating request's latency and availability depend
  on every downstream pillar being up, and blurs who owns the write.
  Synchronous HTTP is fine for **reads** (`Check()` calls to Permissions,
  for example) — it's specifically cross-pillar **writes** that are banned.
- **A single shared "platform events" table instead of Service Bus.**
  Rejected: reinvents a message broker inside SQL, adds polling latency,
  and loses the built-in topic/subscription fan-out Service Bus already
  provides.

## Consequences

- Adding a new event consumer is "add a Service Bus subscription," not "add
  a new caller to an internal write path" — no code change in the
  publishing pillar.
- A pillar's local Audit/Outbox write can never partially fail relative to
  its own entity write (same transaction), but cross-pillar propagation is
  eventually consistent, not immediate — consumers must tolerate at-least-
  once delivery and out-of-order arrival within reason.
- Reporting/Audit-style "give me a view across everything" use cases must
  be built as projections fed by events, not as ad-hoc joins — this is a
  real cost when a quick join would have been easier to write, but it's the
  boundary the pillar split exists to enforce.
- PR previews never wire a live Service Bus connection (see
  [`docs/preview-scenarios.md`](../preview-scenarios.md)), so
  outbox-dependent behavior can only be verified end-to-end against a real
  environment, not a PR preview — previews prove the write side, not
  cross-pillar delivery.

## References

- `AGENTS.md` § Architecture (pillar list, messaging/mutation rules)
- [`docs/db-practices.md`](../db-practices.md) (ownership boundaries, outbox
  pattern, cross-pillar data rules)
- [`docs/architecture/overview.md`](../architecture/overview.md) (pillar map
  and current Service Bus topic/queue list)
- `infra/README.md` § Service Bus topics/queues
