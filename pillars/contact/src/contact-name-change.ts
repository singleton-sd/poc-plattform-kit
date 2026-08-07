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
  findContact(id: string): Promise<Contact | undefined>;
  saveContact(contact: Contact): Promise<void>;
  appendAudit(audit: ContactLocalAudit): Promise<void>;
  appendOutbox(entry: ContactOutboxEntry): Promise<void>;
}

export interface ContactNameChangeStore {
  transaction<T>(operation: (transaction: ContactNameChangeTransaction) => Promise<T>): Promise<T>;
  pendingOutbox(): Promise<ContactOutboxEntry[]>;
  markProcessed(entry: ContactOutboxEntry, at: Date): Promise<void>;
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
    return this.store.transaction(async (transaction) => {
      const contact = await transaction.findContact(input.contactId);
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

      await transaction.saveContact({ ...contact, name: input.name });
      await transaction.appendAudit({
        entityId: contact.id,
        action: 'name_changed',
        actorId: input.actorId,
        changes: { name: { from: contact.name, to: input.name } },
        createdAt: occurredAt,
      });
      await transaction.appendOutbox({ event });
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
    for (const entry of await this.store.pendingOutbox()) {
      await this.publish(entry.event);
      await this.store.markProcessed(entry, this.now());
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

  async transaction<T>(
    operation: (transaction: ContactNameChangeTransaction) => Promise<T>,
  ): Promise<T> {
    const contacts = new Map([...this.contacts].map(([id, contact]) => [id, { ...contact }]));
    const audits: ContactLocalAudit[] = [];
    const outbox: ContactOutboxEntry[] = [];
    const result = await operation({
      findContact: async (id) => contacts.get(id),
      saveContact: async (contact) => void contacts.set(contact.id, contact),
      appendAudit: async (audit) => void audits.push(audit),
      appendOutbox: async (entry) => void outbox.push(entry),
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

  async pendingOutbox(): Promise<ContactOutboxEntry[]> {
    return this.outbox.filter((entry) => !entry.processedAt);
  }

  async markProcessed(entry: ContactOutboxEntry, at: Date): Promise<void> {
    entry.processedAt = at;
  }
}
