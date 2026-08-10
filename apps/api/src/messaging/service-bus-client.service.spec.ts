const createSender = jest.fn().mockReturnValue({ sender: true });
const createReceiver = jest.fn().mockReturnValue({ receiver: true });
const close = jest.fn().mockResolvedValue(undefined);

jest.mock('@azure/service-bus', () => ({
  ServiceBusClient: jest.fn().mockImplementation(() => ({
    createSender,
    createReceiver,
    close,
  })),
}));

import { ServiceBusClient } from '@azure/service-bus';
import { ServiceBusClientService } from './service-bus-client.service';

describe('ServiceBusClientService', () => {
  const originalConnectionString = process.env.AZURE_SERVICEBUS_CONNECTION_STRING;

  afterEach(() => {
    jest.clearAllMocks();
    if (originalConnectionString === undefined) {
      delete process.env.AZURE_SERVICEBUS_CONNECTION_STRING;
    } else {
      process.env.AZURE_SERVICEBUS_CONNECTION_STRING = originalConnectionString;
    }
  });

  describe('when AZURE_SERVICEBUS_CONNECTION_STRING is unset', () => {
    beforeEach(() => {
      delete process.env.AZURE_SERVICEBUS_CONNECTION_STRING;
    });

    it('reports disabled and never constructs a client', () => {
      const service = new ServiceBusClientService();

      expect(service.isEnabled()).toBe(false);
      expect(ServiceBusClient).not.toHaveBeenCalled();
    });

    it('throws instead of silently returning a broken sender/receiver', () => {
      const service = new ServiceBusClientService();

      expect(() => service.getSender('tenant')).toThrow(/not configured/);
      expect(() => service.getQueueSender('notifications.send')).toThrow(/not configured/);
      expect(() => service.getReceiver('tenant', 'audit')).toThrow(/not configured/);
    });
  });

  describe('when AZURE_SERVICEBUS_CONNECTION_STRING is set', () => {
    beforeEach(() => {
      process.env.AZURE_SERVICEBUS_CONNECTION_STRING =
        'Endpoint=sb://example.servicebus.windows.net/;SharedAccessKeyName=test;SharedAccessKey=test';
    });

    it('reports enabled', () => {
      const service = new ServiceBusClientService();

      expect(service.isEnabled()).toBe(true);
    });

    it('resolves senders using the shared events package topic naming', () => {
      const service = new ServiceBusClientService();

      const sender = service.getSender('tenant');

      expect(createSender).toHaveBeenCalledWith('tenant.events');
      expect(sender).toEqual({ sender: true });
    });

    it('resolves queue senders by queue name', () => {
      const service = new ServiceBusClientService();

      const sender = service.getQueueSender('notifications.send');

      expect(createSender).toHaveBeenCalledWith('notifications.send');
      expect(sender).toEqual({ sender: true });
    });

    it('resolves receivers using the shared events package topic + subscription naming', () => {
      const service = new ServiceBusClientService();

      const receiver = service.getReceiver('contact', 'reporting');

      expect(createReceiver).toHaveBeenCalledWith('contact.events', 'reporting');
      expect(receiver).toEqual({ receiver: true });
    });

    it('closes the underlying client on module destroy', async () => {
      const service = new ServiceBusClientService();

      await service.onModuleDestroy();

      expect(close).toHaveBeenCalledTimes(1);
    });
  });
});
