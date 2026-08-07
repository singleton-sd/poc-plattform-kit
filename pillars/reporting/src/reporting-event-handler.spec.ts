import { DOMAIN_EVENT_TYPES, type DomainEvent } from '@poc-plattform-kit/events';
import { ReportingEventHandler, toProjectionRecord } from './reporting-event-handler';

function buildEvent(overrides: Partial<DomainEvent> = {}): DomainEvent {
  return {
    id: 'evt-1',
    type: 'subscription.created',
    pillar: 'subscriptions',
    tenantId: 'tenant-1',
    occurredAt: '2026-01-01T00:00:00.000Z',
    correlationId: 'corr-1',
    payload: { plan: 'pro' },
    ...overrides,
  };
}

describe('toProjectionRecord', () => {
  it('normalizes every domain event type into a ReportingProjectionRecord', () => {
    for (const type of DOMAIN_EVENT_TYPES) {
      const event = buildEvent({ type });

      expect(toProjectionRecord(event)).toEqual({
        eventId: event.id,
        eventType: type,
        sourcePillar: event.pillar,
        tenantId: event.tenantId,
        occurredAt: event.occurredAt,
        payload: event.payload,
      });
    }
  });

  it('carries the event payload through unchanged', () => {
    const event = buildEvent({ payload: { plan: 'enterprise', seats: 42 } });

    expect(toProjectionRecord(event).payload).toEqual({ plan: 'enterprise', seats: 42 });
  });
});

describe('ReportingEventHandler', () => {
  it('resolves with the normalized record for a subscription-delivered event', async () => {
    const handler = new ReportingEventHandler();
    const event = buildEvent({ type: 'permission.granted', pillar: 'permissions' });

    await expect(handler.handle(event)).resolves.toEqual(toProjectionRecord(event));
  });
});
