import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { type EmailProvider, type EmailSendRequest } from '@poc-plattform-kit/pillar-notifications';
import { randomUUID } from 'node:crypto';
import { ServiceBusClientService } from '../messaging/service-bus-client.service';
import type { ContactInquiryResponseDto } from './dto/contact-inquiry-response.dto';
import type { CreateContactInquiryDto } from './dto/create-contact-inquiry.dto';
import { EMAIL_PROVIDER } from './email-provider.token';

const SUBJECT_LABELS: Record<CreateContactInquiryDto['subject'], string> = {
  general: 'General inquiry',
  sales: 'Sales / demo request',
  support: 'Technical support',
  partnership: 'Partnership',
};

export const NOTIFICATIONS_SEND_QUEUE = 'notifications.send';

@Injectable()
export class ContactInquiryService {
  private readonly logger = new Logger(ContactInquiryService.name);

  constructor(
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider & { isConfigured(): boolean },
    private readonly serviceBus: ServiceBusClientService,
  ) {}

  async submit(dto: CreateContactInquiryDto): Promise<ContactInquiryResponseDto> {
    const id = randomUUID();
    const inbox = process.env.CONTACT_INBOX_EMAIL?.trim();
    const from = process.env.CONTACT_FROM_EMAIL?.trim();
    if (!inbox || !from) {
      throw new ServiceUnavailableException(
        'Contact inquiry delivery is not configured (CONTACT_INBOX_EMAIL / CONTACT_FROM_EMAIL).',
      );
    }

    const emailRequest = this.buildEmailRequest(dto, inbox, from, id);

    if (this.email.isConfigured()) {
      await this.email.send(emailRequest);
      return { id, status: 'sent' };
    }

    if (this.serviceBus.isEnabled()) {
      const sender = this.serviceBus.getQueueSender(NOTIFICATIONS_SEND_QUEUE);
      await sender.sendMessages({
        body: {
          type: 'notifications.send',
          channel: 'email',
          correlationId: id,
          kind: 'marketing.contact_inquiry',
          inquiry: {
            id,
            name: dto.name,
            email: dto.email,
            subject: dto.subject,
            message: dto.message,
          },
          email: emailRequest,
        },
        contentType: 'application/json',
        correlationId: id,
      });
      return { id, status: 'queued' };
    }

    this.logger.error(
      'Contact inquiry rejected: neither Forward Email nor Service Bus is available',
    );
    throw new ServiceUnavailableException(
      'Contact inquiry delivery is temporarily unavailable. Please try again later.',
    );
  }

  private buildEmailRequest(
    dto: CreateContactInquiryDto,
    inbox: string,
    from: string,
    correlationId: string,
  ): EmailSendRequest {
    const subjectLabel = SUBJECT_LABELS[dto.subject];
    const text = [
      `New marketing contact inquiry (${subjectLabel})`,
      '',
      `Name: ${dto.name}`,
      `Email: ${dto.email}`,
      `Subject: ${subjectLabel}`,
      '',
      dto.message,
    ].join('\n');

    return {
      to: inbox,
      from,
      replyTo: dto.email,
      subject: `[Platform Kit] ${subjectLabel} — ${dto.name}`,
      text,
      correlationId,
    };
  }
}
