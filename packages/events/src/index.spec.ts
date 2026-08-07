import {
  DOMAIN_EVENT_CONSUMERS,
  DOMAIN_EVENT_TYPES,
  NOTIFICATIONS_TRAIL_CONSUMERS,
  PUBLISHING_PILLARS,
  subscriptionForConsumer,
  topicForPillar,
  type DomainEventType,
} from './index.js';

describe('topicForPillar', () => {
  it('names topics as `{pillar}.events` for every publishing pillar', () => {
    for (const pillar of PUBLISHING_PILLARS) {
      expect(topicForPillar(pillar)).toBe(`${pillar}.events`);
    }
  });
});

describe('subscriptionForConsumer', () => {
  it('names subscriptions after the consuming pillar', () => {
    for (const consumer of DOMAIN_EVENT_CONSUMERS) {
      expect(subscriptionForConsumer(consumer)).toBe(consumer);
    }
  });
});

describe('DOMAIN_EVENT_CONSUMERS / NOTIFICATIONS_TRAIL_CONSUMERS', () => {
  it('matches the consumer set provisioned in infra/servicebus-subscriptions.bicep', () => {
    expect([...DOMAIN_EVENT_CONSUMERS].sort()).toEqual(
      ['audit', 'notifications', 'reporting', 'support'].sort(),
    );
    expect([...NOTIFICATIONS_TRAIL_CONSUMERS].sort()).toEqual(
      ['audit', 'reporting', 'support'].sort(),
    );
  });

  it('keeps the trail consumers a subset of the domain consumers', () => {
    for (const consumer of NOTIFICATIONS_TRAIL_CONSUMERS) {
      expect(DOMAIN_EVENT_CONSUMERS).toContain(consumer);
    }
  });
});

describe('DOMAIN_EVENT_TYPES', () => {
  it('is a non-empty, de-duplicated list', () => {
    expect(DOMAIN_EVENT_TYPES.length).toBeGreaterThan(0);
    expect(new Set(DOMAIN_EVENT_TYPES).size).toBe(DOMAIN_EVENT_TYPES.length);
  });

  it('uses `{domain}.{snake_case_action}` naming for every event type', () => {
    const pattern = /^[a-z]+\.[a-z]+(_[a-z]+)*$/;
    for (const type of DOMAIN_EVENT_TYPES) {
      expect(type).toMatch(pattern);
    }
  });

  it('type checks every literal against the DomainEventType union', () => {
    // If this array falls out of sync with the `DomainEventType` union, the
    // `Record<DomainEventType, true>` in src/index.ts fails to compile —
    // this assertion just exercises that the runtime values agree.
    const typed: readonly DomainEventType[] = DOMAIN_EVENT_TYPES;
    expect(typed).toBe(DOMAIN_EVENT_TYPES);
  });
});
