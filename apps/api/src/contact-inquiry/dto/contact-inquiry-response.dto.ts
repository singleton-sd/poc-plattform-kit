import { ApiProperty } from '@nestjs/swagger';

export class ContactInquiryResponseDto {
  @ApiProperty({ example: 'c7f2c1c0-5f1a-4b9a-9c2e-1d2f3a4b5c6d' })
  id!: string;

  @ApiProperty({ enum: ['queued', 'sent'] })
  status!: 'queued' | 'sent';
}
