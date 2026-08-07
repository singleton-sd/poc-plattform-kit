import type { DomainEvent } from '@poc-plattform-kit/events';

/** Normalized shape the Reporting pillar's read-model projector will consume. */
export interface ReportingProjectionRecord {
  eventId: string;
  eventType: DomainEvent['type'];
  sourcePillar: DomainEvent['pillar'];
  tenantId?: string;
  occurredAt: string;
  payload: Record<string, unknown>;
}

export function toProjectionRecord(event: DomainEvent): ReportingProjectionRecord {
  return {
    eventId: event.id,
    eventType: event.type,
    sourcePillar: event.pillar,
    tenantId: event.tenantId,
    occurredAt: event.occurredAt,
    payload: event.payload,
  };
}

/**
 * Stub for the `reporting` Service Bus subscription consumer registered on
 * every publishing topic (see infra/servicebus-subscriptions.bicep). Wiring
 * a real `ServiceBusReceiver` into this handler, and projecting
 * `ReportingProjectionRecord`s into read models, land with the Reporting
 * pillar's storage ticket.
 */
export class ReportingEventHandler {
  async handle(event: DomainEvent): Promise<ReportingProjectionRecord> {
    return toProjectionRecord(event);
  }
}
