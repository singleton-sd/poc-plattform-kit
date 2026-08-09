/** Shared Service Bus event contracts — pillars publish/subscribe these types. */

export type PillarName =
  | 'tenant'
  | 'single-sign-on'
  | 'permissions'
  | 'subscriptions'
  | 'contact'
  | 'support'
  | 'audit'
  | 'reporting'
  | 'notifications';

/** Pillars that publish domain events on their own `{pillar}.events` topic. */
export type PublishingPillarName =
  'tenant' | 'single-sign-on' | 'permissions' | 'subscriptions' | 'contact' | 'notifications';

/** Pillars that subscribe to every publishing topic (see infra/servicebus-subscriptions.bicep). */
export type DomainEventConsumerName = 'audit' | 'reporting' | 'support' | 'notifications';

/** Pillars that additionally subscribe to Notifications' own `notification.*` trail. */
export type NotificationsTrailConsumerName = 'audit' | 'reporting' | 'support';

export type DomainEventType =
  | 'tenant.created'
  | 'tenant.updated'
  | 'tenant.member_added'
  | 'user.created'
  | 'user.name_changed'
  | 'permission.denied'
  | 'permission.granted'
  | 'subscription.created'
  | 'subscription.changed'
  | 'contact.created'
  | 'contact.name_changed'
  | 'support.ops_action'
  | 'notification.sent'
  | 'notification.failed';

export interface DomainEvent<TPayload = Record<string, unknown>> {
  id: string;
  type: DomainEventType;
  pillar: PillarName;
  tenantId?: string;
  occurredAt: string;
  correlationId?: string;
  payload: TPayload;
}

/** Topic naming: `{pillar}.events`. */
export function topicForPillar(pillar: PublishingPillarName): string {
  return `${pillar}.events`;
}

/**
 * Subscription naming: the consumer pillar's own name (e.g. subscription
 * `audit` on topic `tenant.events`). Kept as a named helper so call sites
 * read the same way as `topicForPillar` rather than inlining the string.
 */
export function subscriptionForConsumer(consumer: DomainEventConsumerName): string {
  return consumer;
}

/**
 * Exhaustive by construction: `Record<PublishingPillarName, true>` forces
 * every publishing pillar to be listed here and rejects anything extra, so
 * this stays in sync with the `PublishingPillarName` union at compile time.
 */
const publishingPillarSet: Record<PublishingPillarName, true> = {
  tenant: true,
  'single-sign-on': true,
  permissions: true,
  subscriptions: true,
  contact: true,
  notifications: true,
};

export const PUBLISHING_PILLARS = Object.keys(publishingPillarSet) as PublishingPillarName[];

const domainEventConsumerSet: Record<DomainEventConsumerName, true> = {
  audit: true,
  reporting: true,
  support: true,
  notifications: true,
};

export const DOMAIN_EVENT_CONSUMERS = Object.keys(
  domainEventConsumerSet,
) as DomainEventConsumerName[];

const notificationsTrailConsumerSet: Record<NotificationsTrailConsumerName, true> = {
  audit: true,
  reporting: true,
  support: true,
};

export const NOTIFICATIONS_TRAIL_CONSUMERS = Object.keys(
  notificationsTrailConsumerSet,
) as NotificationsTrailConsumerName[];

/**
 * Exhaustive by construction (same trick as above): every `DomainEventType`
 * must appear as a key, and no unlisted string can sneak in, so this is the
 * single source of truth contract tests check against.
 */
const domainEventTypeSet: Record<DomainEventType, true> = {
  'tenant.created': true,
  'tenant.updated': true,
  'tenant.member_added': true,
  'user.created': true,
  'user.name_changed': true,
  'permission.denied': true,
  'permission.granted': true,
  'subscription.created': true,
  'subscription.changed': true,
  'contact.created': true,
  'contact.name_changed': true,
  'support.ops_action': true,
  'notification.sent': true,
  'notification.failed': true,
};

export const DOMAIN_EVENT_TYPES = Object.keys(domainEventTypeSet) as DomainEventType[];
