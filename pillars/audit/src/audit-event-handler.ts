import type { DomainEvent } from '@poc-plattform-kit/events';

/** Normalized shape the Audit pillar's trail table will persist. */
export interface AuditRecord {
  eventId: string;
  eventType: DomainEvent['type'];
  sourcePillar: DomainEvent['pillar'];
  tenantId?: string;
  occurredAt: string;
  correlationId?: string;
}

export function toAuditRecord(event: DomainEvent): AuditRecord {
  return {
    eventId: event.id,
    eventType: event.type,
    sourcePillar: event.pillar,
    tenantId: event.tenantId,
    occurredAt: event.occurredAt,
    correlationId: event.correlationId,
  };
}

/**
 * Stub for the `audit` Service Bus subscription consumer registered on every
 * publishing topic (see infra/servicebus-subscriptions.bicep). Wiring a real
 * `ServiceBusReceiver` into this handler, and persisting `AuditRecord`s via
 * Prisma, land with the Audit pillar's storage ticket.
 */
export class AuditEventHandler {
  async handle(event: DomainEvent): Promise<AuditRecord> {
    return toAuditRecord(event);
  }
}
