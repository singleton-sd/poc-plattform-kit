import { AuditEventHandler, type AuditRecord } from '../../audit/src';
import { ReportingEventHandler, type ReportingProjectionRecord } from '../../reporting/src';
import type { DomainEvent } from '@poc-plattform-kit/events';
import {
  ContactNameChangeService,
  InMemoryContactNameChangeStore,
  OutboxDispatcher,
} from './contact-name-change';

describe('contact.name_changed end-to-end', () => {
  it('writes contact + local audit + outbox atomically, then updates consumers', async () => {
    const store = new InMemoryContactNameChangeStore([
      { id: 'contact-1', tenantId: 'tenant-1', name: 'Old name' },
    ]);
    const service = new ContactNameChangeService(store, {
      newId: () => 'event-1',
      now: () => new Date('2026-08-07T12:00:00.000Z'),
    });

    const event = await service.changeName({
      contactId: 'contact-1',
      name: 'New name',
      actorId: 'user-1',
      correlationId: 'request-1',
    });

    expect(store.contacts.get('contact-1')?.name).toBe('New name');
    expect(store.localAudit).toEqual([
      expect.objectContaining({
        entityId: 'contact-1',
        action: 'name_changed',
        actorId: 'user-1',
        changes: { name: { from: 'Old name', to: 'New name' } },
      }),
    ]);
    expect(store.outbox).toEqual([{ event, processedAt: undefined }]);

    const centralAudit: AuditRecord[] = [];
    const reporting: ReportingProjectionRecord[] = [];
    const auditHandler = new AuditEventHandler({
      save: async (row) => void centralAudit.push(row),
    });
    const reportingHandler = new ReportingEventHandler({
      save: async (row) => void reporting.push(row),
    });
    const mockedServiceBus = async (published: DomainEvent) => {
      await Promise.all([auditHandler.handle(published), reportingHandler.handle(published)]);
    };

    await new OutboxDispatcher(
      store,
      mockedServiceBus,
      () => new Date('2026-08-07T12:00:00.000Z'),
    ).dispatchPending();

    expect(centralAudit).toEqual([
      expect.objectContaining({ eventId: 'event-1', eventType: 'contact.name_changed' }),
    ]);
    expect(reporting).toEqual([
      expect.objectContaining({
        eventId: 'event-1',
        payload: { contactId: 'contact-1', oldName: 'Old name', name: 'New name' },
      }),
    ]);
    expect(store.outbox[0]?.processedAt).toEqual(new Date('2026-08-07T12:00:00.000Z'));
  });

  it('rolls back all local writes when the transaction fails', async () => {
    const store = new InMemoryContactNameChangeStore([
      { id: 'contact-1', tenantId: 'tenant-1', name: 'Old name' },
    ]);
    store.failNextTransaction = true;
    const service = new ContactNameChangeService(store);

    await expect(
      service.changeName({ contactId: 'contact-1', name: 'New name', actorId: 'user-1' }),
    ).rejects.toThrow('Transaction failed');
    expect(store.contacts.get('contact-1')?.name).toBe('Old name');
    expect(store.localAudit).toEqual([]);
    expect(store.outbox).toEqual([]);
  });
});
