import type { ServiceBusSender } from '@azure/service-bus';
import { OutboxDrainerService, type OutboxStore } from './outbox-drainer.service';

describe('OutboxDrainerService', () => {
  const row = {
    id: 'outbox-1',
    eventType: 'tenant.created',
    payload: JSON.stringify({ id: 'tenant-1', name: 'Acme' }),
    occurredAt: new Date('2026-08-08T10:00:00.000Z'),
  };

  function setup() {
    const store: jest.Mocked<OutboxStore> = {
      claimUnpublished: jest.fn().mockResolvedValue([row]),
      markPublished: jest.fn().mockResolvedValue(true),
      markFailed: jest.fn().mockResolvedValue(true),
      releaseClaim: jest.fn().mockResolvedValue(undefined),
    };
    const sender = {
      sendMessages: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ServiceBusSender>;
    const serviceBus = {
      isEnabled: jest.fn().mockReturnValue(true),
      getSender: jest.fn().mockReturnValue(sender),
    };

    return {
      store,
      sender,
      serviceBus,
      service: new OutboxDrainerService(serviceBus, [{ pillar: 'tenant', store }]),
    };
  }

  it('publishes an unpublished row and marks it published', async () => {
    const { service, sender, store } = setup();

    await service.drainOnce();

    expect(sender.sendMessages).toHaveBeenCalledWith({
      body: { id: 'tenant-1', name: 'Acme' },
      contentType: 'application/json',
      messageId: 'outbox-1',
      subject: 'tenant.created',
      applicationProperties: {
        occurredAt: '2026-08-08T10:00:00.000Z',
        pillar: 'tenant',
      },
    });
    expect(store.markPublished).toHaveBeenCalledWith(
      'outbox-1',
      expect.any(String),
      expect.any(Date),
    );
    expect(sender.close).toHaveBeenCalledTimes(1);
  });

  it('leaves the row unpublished when publishing fails so retry is safe', async () => {
    const { service, sender, store } = setup();
    sender.sendMessages.mockRejectedValueOnce(new Error('Service Bus unavailable'));

    await expect(service.drainOnce()).rejects.toThrow('Service Bus unavailable');

    expect(store.markPublished).not.toHaveBeenCalled();
    expect(store.releaseClaim).toHaveBeenCalledWith('outbox-1', expect.any(String));
    expect(sender.close).toHaveBeenCalledTimes(1);
  });

  it('uses the outbox id as the stable message id across retries', async () => {
    const { service, sender } = setup();
    sender.sendMessages.mockRejectedValueOnce(new Error('timeout'));

    await expect(service.drainOnce()).rejects.toThrow('timeout');
    await service.drainOnce();

    expect(sender.sendMessages).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ messageId: 'outbox-1' }),
    );
    expect(sender.sendMessages).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ messageId: 'outbox-1' }),
    );
  });

  it('does nothing when Service Bus is disabled', async () => {
    const { service, serviceBus, store } = setup();
    serviceBus.isEnabled.mockReturnValue(false);

    await expect(service.drainOnce()).resolves.toEqual({ published: 0 });

    expect(store.claimUnpublished).not.toHaveBeenCalled();
    expect(serviceBus.getSender).not.toHaveBeenCalled();
  });

  it('coalesces overlapping drains into one run', async () => {
    const { service, store } = setup();
    let release: (() => void) | undefined;
    store.claimUnpublished.mockReturnValue(
      new Promise((resolve) => {
        release = () => resolve([row]);
      }),
    );

    const first = service.drainOnce();
    const second = service.drainOnce();
    release?.();

    await expect(Promise.all([first, second])).resolves.toEqual([
      { published: 1 },
      { published: 1 },
    ]);
    expect(store.claimUnpublished).toHaveBeenCalledTimes(1);
  });

  it('quarantines malformed JSON and continues with later rows', async () => {
    const { service, sender, store } = setup();
    store.claimUnpublished.mockResolvedValue([
      { ...row, id: 'bad', payload: '{not-json' },
      { ...row, id: 'good' },
    ]);

    await expect(service.drainOnce()).resolves.toEqual({ published: 1 });

    expect(store.markFailed).toHaveBeenCalledWith(
      'bad',
      expect.any(String),
      expect.any(Date),
      expect.any(String),
    );
    expect(sender.sendMessages).toHaveBeenCalledTimes(1);
    expect(store.markPublished).toHaveBeenCalledWith('good', expect.any(String), expect.any(Date));
  });
});
