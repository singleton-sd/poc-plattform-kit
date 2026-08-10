import { ServiceUnavailableException } from '@nestjs/common';
import type { EmailProvider } from '@poc-plattform-kit/pillar-notifications';
import type { ServiceBusClientService } from '../messaging/service-bus-client.service';
import { ContactInquiryService } from './contact-inquiry.service';

describe('ContactInquiryService', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  function createService(overrides?: {
    email?: Partial<EmailProvider> & { isConfigured?: () => boolean };
    bus?: Partial<ServiceBusClientService>;
  }) {
    const email: EmailProvider & { isConfigured: () => boolean } = {
      name: 'forward-email',
      isConfigured: () => false,
      send: jest.fn(),
      ...overrides?.email,
    };
    const sendMessages = jest.fn().mockResolvedValue(undefined);
    const bus = {
      isEnabled: () => false,
      getQueueSender: jest.fn().mockReturnValue({ sendMessages }),
      ...overrides?.bus,
    } as unknown as ServiceBusClientService;

    return {
      service: new ContactInquiryService(email, bus),
      email,
      bus,
      sendMessages,
    };
  }

  it('sends via Forward Email when the provider is configured', async () => {
    process.env.CONTACT_INBOX_EMAIL = 'hello@singletonsd.com';
    process.env.CONTACT_FROM_EMAIL = 'noreply@plattform-kit.poc.singletonsd.com';
    const send = jest.fn().mockResolvedValue({ providerMessageId: 'msg-1', accepted: true });
    const { service, email } = createService({
      email: { isConfigured: () => true, send },
    });

    const result = await service.submit({
      name: 'Jane Doe',
      email: 'jane@acme.com',
      subject: 'sales',
      message: 'I would like a demo of Platform Kit.',
    });

    expect(result.status).toBe('sent');
    expect(result.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(email.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'hello@singletonsd.com',
        from: 'noreply@plattform-kit.poc.singletonsd.com',
        replyTo: 'jane@acme.com',
        subject: expect.stringMatching(/Sales \/ demo request/i),
      }),
    );
  });

  it('queues notifications.send when email is unavailable but Service Bus is enabled', async () => {
    process.env.CONTACT_INBOX_EMAIL = 'hello@singletonsd.com';
    process.env.CONTACT_FROM_EMAIL = 'noreply@plattform-kit.poc.singletonsd.com';
    const { service, bus, sendMessages } = createService({
      bus: { isEnabled: () => true },
    });

    const result = await service.submit({
      name: 'Jane Doe',
      email: 'jane@acme.com',
      subject: 'support',
      message: 'Need help with SSO setup please.',
    });

    expect(result.status).toBe('queued');
    expect(bus.getQueueSender).toHaveBeenCalledWith('notifications.send');
    expect(sendMessages).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          type: 'notifications.send',
          channel: 'email',
        }),
      }),
    );
  });

  it('fails closed when neither email nor Service Bus can accept the inquiry', async () => {
    process.env.CONTACT_INBOX_EMAIL = 'hello@singletonsd.com';
    process.env.CONTACT_FROM_EMAIL = 'noreply@plattform-kit.poc.singletonsd.com';
    const { service } = createService();

    await expect(
      service.submit({
        name: 'Jane Doe',
        email: 'jane@acme.com',
        subject: 'general',
        message: 'Just saying hello from the marketing site.',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
