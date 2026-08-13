import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TenantGroupMembershipResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  tenantId!: string;

  @ApiProperty()
  groupId!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ enum: ['pending', 'synced', 'failed'] })
  syncStatus!: string;

  @ApiPropertyOptional({ nullable: true })
  syncError!: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  syncedAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}
