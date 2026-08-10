import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DenyAccessRequestDto {
  @ApiProperty({
    required: false,
    example: 'Not required for this role',
    description: 'Optional denial reason shared with the requester.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
