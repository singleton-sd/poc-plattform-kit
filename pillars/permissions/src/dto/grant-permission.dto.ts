import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsISO8601, IsNotEmpty, IsString, Matches, ValidateIf } from 'class-validator';

const OPEN_FGA_OBJECT = /^[^:\s]+:[^\s:][^\s]*$/;

export enum PermissionGrantType {
  Permanent = 'permanent',
  Temporary = 'temporary',
  OneTime = 'one_time',
}

export class GrantPermissionDto {
  @ApiProperty({ example: 'user:alice', description: 'OpenFGA subject identifier.' })
  @IsString()
  @IsNotEmpty()
  @Matches(OPEN_FGA_OBJECT)
  subject!: string;

  @ApiProperty({ example: 'update', description: 'OpenFGA relation or permission.' })
  @IsString()
  @IsNotEmpty()
  action!: string;

  @ApiProperty({
    example: 'tenant:acme',
    description: 'OpenFGA resource identifier.',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(OPEN_FGA_OBJECT)
  resource!: string;

  @ApiProperty({
    enum: PermissionGrantType,
    example: PermissionGrantType.Permanent,
    description:
      'permanent | temporary (OpenFGA expiry condition) | one_time (revoked after first successful Check).',
  })
  @IsEnum(PermissionGrantType)
  grantType!: PermissionGrantType;

  @ApiProperty({
    required: false,
    example: '2026-12-31T23:59:59.000Z',
    description: 'Required when grantType is temporary — absolute expiry (ISO-8601).',
  })
  @ValidateIf((dto: GrantPermissionDto) => dto.grantType === PermissionGrantType.Temporary)
  @IsISO8601()
  @IsNotEmpty()
  expiresAt?: string;
}
