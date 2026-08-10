import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../single-sign-on/public.decorator';
import { ContactInquiryService } from './contact-inquiry.service';
import { ContactInquiryResponseDto } from './dto/contact-inquiry-response.dto';
import { CreateContactInquiryDto } from './dto/create-contact-inquiry.dto';

@ApiTags('contact')
@Controller('contact')
export class ContactInquiryController {
  constructor(private readonly inquiries: ContactInquiryService) {}

  @Post()
  @Public()
  @HttpCode(202)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOkResponse({
    type: ContactInquiryResponseDto,
    description:
      'Inquiry accepted for delivery (sent synchronously when Forward Email is configured).',
  })
  @ApiAcceptedResponse({
    type: ContactInquiryResponseDto,
    description: 'Inquiry queued on notifications.send for async delivery.',
  })
  @ApiBadRequestResponse({ description: 'Validation failed.' })
  @ApiTooManyRequestsResponse({ description: 'Too many contact submissions from this client.' })
  @ApiServiceUnavailableResponse({
    description: 'Neither Forward Email nor Service Bus delivery is available.',
  })
  create(@Body() dto: CreateContactInquiryDto): Promise<ContactInquiryResponseDto> {
    return this.inquiries.submit(dto);
  }
}
