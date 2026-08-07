import { DOMAIN_EVENT_TYPES, type DomainEvent } from '@poc-plattform-kit/events';
import { AuditEventHandler, toAuditRecord } from './audit-event-handler';

function buildEvent(overrides: Partial<DomainEvent> = {}): DomainEvent {
  return {
    id: 'evt-1',
    type: 'tenant.created',
    pillar: 'tenant',
    tenantId: 'tenant-1',
    occurredAt: '2026-01-01T00:00:00.000Z',
    correlationId: 'corr-1',
    payload: {},
    ...overrides,
  };
}

describe('toAuditRecord', () => {
  it('normalizes every domain event type into an AuditRecord', () => {
    for (const type of DOMAIN_EVENT_TYPES) {
      const event = buildEvent({ type });

      expect(toAuditRecord(event)).toEqual({
        eventId: event.id,
        eventType: type,
        sourcePillar: event.pillar,
        tenantId: event.tenantId,
        occurredAt: event.occurredAt,
        correlationId: event.correlationId,
      });
    }
  });

  it('carries through an absent tenantId/correlationId unchanged', () => {
    const event = buildEvent({ tenantId: undefined, correlationId: undefined });

    const record = toAuditRecord(event);

    expect(record.tenantId).toBeUndefined();
    expect(record.correlationId).toBeUndefined();
  });
});

describe('AuditEventHandler', () => {
  it('resolves with the normalized record for a subscription-delivered event', async () => {
    const handler = new AuditEventHandler();
    const event = buildEvent({ type: 'contact.created', pillar: 'contact' });

    await expect(handler.handle(event)).resolves.toEqual(toAuditRecord(event));
  });
});
