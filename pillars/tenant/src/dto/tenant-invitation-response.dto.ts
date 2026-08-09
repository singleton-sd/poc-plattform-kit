import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TenantInvitationResponseDto {
  @ApiProperty({ format: 'uuid', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id!: string;

  @ApiProperty({ format: 'uuid', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  tenantId!: string;

  @ApiProperty({ example: 'newmember@example.test' })
  email!: string;

  @ApiProperty({ example: 'member' })
  role!: string;

  @ApiProperty({
    description: 'Local User.id (or Entra oid fallback) of the caller who created the invitation.',
  })
  invitedByUserId!: string;

  @ApiProperty({
    enum: ['pending', 'accepted', 'declined', 'revoked', 'expired'],
    example: 'pending',
  })
  status!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  expiresAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'When the invitation left "pending" (accepted/declined/revoked/expired), or null.',
  })
  respondedAt!: Date | null;

  // Intentionally no `token` field here -- the raw token only ever leaves
  // this service inside the same-transaction `tenant.invitation_created`
  // outbox event (for the Notifications pillar to email it). Exposing it
  // through list/create responses would let any caller who can list
  // invitations also accept them on the invitee's behalf.
}
