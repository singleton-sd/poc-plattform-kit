/** Shared Service Bus event contracts — pillars publish/subscribe these types. */

export type PillarName =
  | 'tenant'
  | 'single-sign-on'
  | 'permissions'
  | 'subscriptions'
  | 'contact'
  | 'support'
  | 'audit'
  | 'reporting';

export type DomainEventType =
  | 'tenant.created'
  | 'tenant.updated'
  | 'user.created'
  | 'user.name_changed'
  | 'permission.denied'
  | 'permission.granted'
  | 'subscription.created'
  | 'subscription.changed'
  | 'contact.created'
  | 'contact.name_changed'
  | 'support.ops_action';

export interface DomainEvent<TPayload = Record<string, unknown>> {
  id: string;
  type: DomainEventType;
  pillar: PillarName;
  tenantId?: string;
  occurredAt: string;
  correlationId?: string;
  payload: TPayload;
}

/** Topic naming: `{pillar}.events` */
export function topicForPillar(pillar: PillarName): string {
  return `${pillar}.events`;
}
