import { ApiProperty } from '@nestjs/swagger';

export class AccessRequestResponseDto {
  @ApiProperty({ example: 'ar_01' })
  id!: string;

  @ApiProperty({ example: 't_acme' })
  tenantId!: string;

  @ApiProperty({ example: 'user-1' })
  requesterId!: string;

  @ApiProperty({ example: 'entra-oid-1' })
  requesterEntraOid!: string;

  @ApiProperty({ example: 'update' })
  action!: string;

  @ApiProperty({ example: 'tenant:acme' })
  resource!: string;

  @ApiProperty({
    example: 'pending',
    description: 'pending | approving | approved | denied | expired',
  })
  status!: string;

  @ApiProperty({ required: false, nullable: true, type: String, example: 'admin-1' })
  decidedById!: string | null;

  @ApiProperty({ required: false, nullable: true, type: String, format: 'date-time' })
  decidedAt!: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    type: String,
    example: 'Not justified',
  })
  denyReason!: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    type: String,
    example: 'permanent',
    description: 'permanent | temporary | one_time when approved',
  })
  grantType!: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    type: String,
    format: 'date-time',
    description: 'When the pending request expires if still undecided.',
  })
  requestExpiresAt!: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    type: String,
    format: 'date-time',
    description: 'Grant expiry when grantType is temporary (set on approve).',
  })
  grantExpiresAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}
