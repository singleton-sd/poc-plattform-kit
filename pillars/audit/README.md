# Audit pillar

Owns: platform-wide audit trail — a durable, queryable record of domain
events raised by other pillars (plus each pillar's own local Audit table for
its mutations; see `docs/db-practices.md`).

- **Consumes:** every publishing pillar's `{pillar}.events` topic via its own
  `audit` subscription, and `notifications.events` for the `notification.*`
  trail (see `packages/events` for topic/subscription naming and
  `infra/servicebus-subscriptions.bicep` for provisioning).
- **Publishes:** none today.

## Stub behavior

`AuditEventHandler.handle(event)` normalizes any `DomainEvent` into an
`AuditRecord` — the shape this pillar's trail table persists. Wiring a real
`ServiceBusReceiver` (via the platform host's `ServiceBusClientService`) and
writing `AuditRecord`s through Prisma land with this pillar's storage ticket.
