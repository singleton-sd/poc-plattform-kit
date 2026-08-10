import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ContactInquiryController } from './contact-inquiry.controller';
import { ContactInquiryService } from './contact-inquiry.service';
import { CreateContactInquiryDto } from './dto/create-contact-inquiry.dto';

describe('ContactInquiryController', () => {
  let controller: ContactInquiryController;
  const submit = jest.fn();

  beforeEach(async () => {
    submit.mockReset();
    const module = await Test.createTestingModule({
      controllers: [ContactInquiryController],
      providers: [{ provide: ContactInquiryService, useValue: { submit } }],
    }).compile();
    controller = module.get(ContactInquiryController);
  });

  it('accepts a valid public inquiry payload', async () => {
    submit.mockResolvedValue({ id: 'inq-1', status: 'queued' });

    await expect(
      controller.create({
        name: 'Jane Doe',
        email: 'jane@acme.com',
        subject: 'sales',
        message: 'I would like a demo of Platform Kit.',
      }),
    ).resolves.toEqual({ id: 'inq-1', status: 'queued' });
    expect(submit).toHaveBeenCalled();
  });

  it('rejects invalid bodies through the shared ValidationPipe contract', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    await expect(
      pipe.transform(
        {
          name: '',
          email: 'not-an-email',
          subject: 'billing',
          message: 'short',
        },
        { type: 'body', metatype: CreateContactInquiryDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
