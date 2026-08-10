import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

const OPEN_FGA_OBJECT = /^[^:\s]+:[^\s:][^\s]*$/;

export class CreateAccessRequestDto {
  @ApiProperty({ example: 'update', description: 'Denied OpenFGA action / relation.' })
  @IsString()
  @IsNotEmpty()
  action!: string;

  @ApiProperty({
    example: 'tenant:acme',
    description: 'Denied OpenFGA resource object.',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(OPEN_FGA_OBJECT)
  resource!: string;

  @ApiProperty({
    required: false,
    example: 't_acme',
    description:
      'Optional tenant id. Defaults to the session tenant. If set to a different tenant, the caller must be a member of that tenant.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  tenantId?: string;

  @ApiProperty({
    required: false,
    example: '2026-12-31T23:59:59.000Z',
    description: 'Optional absolute expiry for the pending request itself (ISO-8601).',
  })
  @IsOptional()
  @IsISO8601()
  requestExpiresAt?: string;
}
