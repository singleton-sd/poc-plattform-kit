# Reporting pillar

Owns: cross-pillar read models / reporting projections built from domain
events (never cross-pillar SQL joins — see `docs/db-practices.md`).

- **Consumes:** every publishing pillar's `{pillar}.events` topic via its own
  `reporting` subscription, and `notifications.events` for the
  `notification.*` trail (see `packages/events` for topic/subscription
  naming and `infra/servicebus-subscriptions.bicep` for provisioning).
- **Publishes:** none today.

## Stub behavior

`ReportingEventHandler.handle(event)` normalizes any `DomainEvent` into a
`ReportingProjectionRecord` — the shape this pillar's projections are built
from. Wiring a real `ServiceBusReceiver` (via the platform host's
`ServiceBusClientService`) and writing projections through Prisma land with
this pillar's storage ticket.
