import { ApiProperty } from '@nestjs/swagger';

export class TenantMembershipResponseDto {
  @ApiProperty({ example: 'tenant-id' })
  tenantId!: string;

  @ApiProperty({ example: 'owner' })
  role!: string;
}

/** Documented `GET /api/me` body — keep in sync with `toMeResponse`. */
export class MeResponseDto {
  @ApiProperty({ example: 'oid-or-local-user-id' })
  id!: string;

  @ApiProperty({ example: 'agent@example.com' })
  email!: string;

  @ApiProperty({ type: String, nullable: true, example: 'Agent' })
  name!: string | null;

  @ApiProperty({
    type: [String],
    example: ['support-agent', 'tenant-admin'],
    description: 'Coarse Entra app roles from the access token / session.',
  })
  roles!: string[];

  @ApiProperty({ type: [TenantMembershipResponseDto] })
  memberships!: TenantMembershipResponseDto[];
}
