# @poc-plattform-kit/events

Shared Azure Service Bus event contracts. Pillars import types and naming
helpers from here instead of hardcoding topic/subscription strings; the
actual Azure resources are provisioned in
[`infra/servicebus-subscriptions.bicep`](../../infra/servicebus-subscriptions.bicep)
and must stay in sync with the constants below.

## Topic naming

**Topic = `{pillar}.events`**, built with `topicForPillar(pillar)`.

Only pillars that publish domain events get a topic (`PUBLISHING_PILLARS`):

| Pillar | Topic |
| --- | --- |
| `tenant` | `tenant.events` |
| `single-sign-on` | `single-sign-on.events` |
| `permissions` | `permissions.events` |
| `subscriptions` | `subscriptions.events` |
| `contact` | `contact.events` |
| `notifications` | `notifications.events` |

`Support`, `Audit`, and `Reporting` only consume — they don't publish, so
they have no topic of their own today.

## Subscription naming

**Subscription = the consuming pillar's own name**, built with
`subscriptionForConsumer(consumer)` (e.g. subscription `audit` on topic
`tenant.events`).

`DOMAIN_EVENT_CONSUMERS` (`audit`, `reporting`, `support`, `notifications`)
each get a subscription on every publishing topic. `notifications.events`
is the exception: Notifications doesn't subscribe to itself, so only
`NOTIFICATIONS_TRAIL_CONSUMERS` (`audit`, `reporting`, `support`) get a
subscription there, to project the `notification.sent` / `notification.failed`
trail.

## Event types

`DomainEventType` is the exhaustive union of event names carried in
`DomainEvent.payload`'s envelope (`DomainEvent.type`). `DOMAIN_EVENT_TYPES`
mirrors the union as a runtime array — see `src/index.ts` for how the
`Record<DomainEventType, true>` trick keeps the two from drifting apart
(a missing or extra key fails `tsc`).

## Adding a new event type or pillar

1. Add the literal to `PillarName` / `DomainEventType` (and
   `PublishingPillarName` if the pillar publishes) in `src/index.ts`.
2. Add the matching key to the corresponding `Record<..., true>` — the
   compiler will point at this file if you forget.
3. Update `infra/servicebus-subscriptions.bicep` with the new topic and/or
   subscriptions.
4. Update the tables above.
