import type { DomainEvent } from '@poc-plattform-kit/events';

export interface Contact {
  id: string;
  tenantId: string;
  name: string;
}

export interface ContactLocalAudit {
  entityId: string;
  action: 'name_changed';
  actorId: string;
  changes: { name: { from: string; to: string } };
  createdAt: Date;
}

export interface ContactOutboxEntry {
  event: DomainEvent<ContactNameChangedPayload>;
  processedAt?: Date;
}

export interface ContactNameChangedPayload extends Record<string, unknown> {
  contactId: string;
  oldName: string;
  name: string;
}

export interface ContactNameChangeTransaction {
  findContact(id: string): Contact | undefined;
  saveContact(contact: Contact): void;
  appendAudit(audit: ContactLocalAudit): void;
  appendOutbox(entry: ContactOutboxEntry): void;
}

export interface ContactNameChangeStore {
  transaction<T>(operation: (transaction: ContactNameChangeTransaction) => T): Promise<T>;
  pendingOutbox(): ContactOutboxEntry[];
  markProcessed(entry: ContactOutboxEntry, at: Date): void;
}

interface ServiceDependencies {
  newId: () => string;
  now: () => Date;
}

const defaultDependencies: ServiceDependencies = {
  newId: () => globalThis.crypto.randomUUID(),
  now: () => new Date(),
};

export class ContactNameChangeService {
  constructor(
    private readonly store: ContactNameChangeStore,
    private readonly dependencies: ServiceDependencies = defaultDependencies,
  ) {}

  async changeName(input: {
    contactId: string;
    name: string;
    actorId: string;
    correlationId?: string;
  }): Promise<DomainEvent<ContactNameChangedPayload>> {
    return this.store.transaction((transaction) => {
      const contact = transaction.findContact(input.contactId);
      if (!contact) throw new Error(`Contact ${input.contactId} not found`);

      const occurredAt = this.dependencies.now();
      const payload: ContactNameChangedPayload = {
        contactId: contact.id,
        oldName: contact.name,
        name: input.name,
      };
      const event: DomainEvent<ContactNameChangedPayload> = {
        id: this.dependencies.newId(),
        type: 'contact.name_changed',
        pillar: 'contact',
        tenantId: contact.tenantId,
        occurredAt: occurredAt.toISOString(),
        correlationId: input.correlationId,
        payload,
      };

      transaction.saveContact({ ...contact, name: input.name });
      transaction.appendAudit({
        entityId: contact.id,
        action: 'name_changed',
        actorId: input.actorId,
        changes: { name: { from: contact.name, to: input.name } },
        createdAt: occurredAt,
      });
      transaction.appendOutbox({ event });
      return event;
    });
  }
}

export class OutboxDispatcher {
  constructor(
    private readonly store: ContactNameChangeStore,
    private readonly publish: (event: DomainEvent) => Promise<void>,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async dispatchPending(): Promise<void> {
    for (const entry of this.store.pendingOutbox()) {
      await this.publish(entry.event);
      this.store.markProcessed(entry, this.now());
    }
  }
}

/** Test adapter that also documents the atomic persistence contract. */
export class InMemoryContactNameChangeStore implements ContactNameChangeStore {
  readonly contacts = new Map<string, Contact>();
  readonly localAudit: ContactLocalAudit[] = [];
  readonly outbox: ContactOutboxEntry[] = [];
  failNextTransaction = false;

  constructor(contacts: Contact[] = []) {
    for (const contact of contacts) this.contacts.set(contact.id, { ...contact });
  }

  async transaction<T>(operation: (transaction: ContactNameChangeTransaction) => T): Promise<T> {
    const contacts = new Map([...this.contacts].map(([id, contact]) => [id, { ...contact }]));
    const audits: ContactLocalAudit[] = [];
    const outbox: ContactOutboxEntry[] = [];
    const result = operation({
      findContact: (id) => contacts.get(id),
      saveContact: (contact) => contacts.set(contact.id, contact),
      appendAudit: (audit) => audits.push(audit),
      appendOutbox: (entry) => outbox.push(entry),
    });
    if (this.failNextTransaction) {
      this.failNextTransaction = false;
      throw new Error('Transaction failed');
    }
    this.contacts.clear();
    for (const [id, contact] of contacts) this.contacts.set(id, contact);
    this.localAudit.push(...audits);
    this.outbox.push(...outbox);
    return result;
  }

  pendingOutbox(): ContactOutboxEntry[] {
    return this.outbox.filter((entry) => !entry.processedAt);
  }

  markProcessed(entry: ContactOutboxEntry, at: Date): void {
    entry.processedAt = at;
  }
}
