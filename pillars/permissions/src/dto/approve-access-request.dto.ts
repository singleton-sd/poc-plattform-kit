import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsISO8601, IsNotEmpty, ValidateIf } from 'class-validator';
import { PermissionGrantType } from './grant-permission.dto';

export class ApproveAccessRequestDto {
  @ApiProperty({
    enum: PermissionGrantType,
    example: PermissionGrantType.Permanent,
    description: 'Grant type applied on approval (calls Grant API).',
  })
  @IsEnum(PermissionGrantType)
  grantType!: PermissionGrantType;

  @ApiProperty({
    required: false,
    example: '2026-12-31T23:59:59.000Z',
    description: 'Required when grantType is temporary — absolute expiry (ISO-8601).',
  })
  @ValidateIf((dto: ApproveAccessRequestDto) => dto.grantType === PermissionGrantType.Temporary)
  @IsISO8601()
  @IsNotEmpty()
  expiresAt?: string;
}
