import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export const CONTACT_INQUIRY_SUBJECTS = ['general', 'sales', 'support', 'partnership'] as const;

export type ContactInquirySubject = (typeof CONTACT_INQUIRY_SUBJECTS)[number];

export class CreateContactInquiryDto {
  @ApiProperty({ example: 'Jane Doe', maxLength: 120 })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'jane@acme.com' })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ enum: CONTACT_INQUIRY_SUBJECTS })
  @IsIn(CONTACT_INQUIRY_SUBJECTS)
  subject!: ContactInquirySubject;

  @ApiProperty({ example: 'I would like a demo of Platform Kit.', minLength: 10, maxLength: 5000 })
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  message!: string;
}
