import { Module } from '@nestjs/common';
import { ForwardEmailProvider } from '@poc-plattform-kit/pillar-notifications';
import { ContactInquiryController } from './contact-inquiry.controller';
import { ContactInquiryService } from './contact-inquiry.service';
import { EMAIL_PROVIDER } from './email-provider.token';

@Module({
  controllers: [ContactInquiryController],
  providers: [
    ContactInquiryService,
    {
      provide: EMAIL_PROVIDER,
      useFactory: () => new ForwardEmailProvider(),
    },
  ],
})
export class ContactInquiryModule {}
