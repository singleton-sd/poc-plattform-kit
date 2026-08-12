import { ApiProperty } from '@nestjs/swagger';

export class TenantInvitationResponseDto {
  // Prisma defaults these to cuid() — do not advertise format: 'uuid'.
  @ApiProperty({ example: 'clx1tenantinvitation000000001' })
  id!: string;

  @ApiProperty({ example: 'clx1tenant00000000000000001' })
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

  // Always present on the response (never omitted), just possibly null --
  // @ApiProperty + nullable, not @ApiPropertyOptional, so the generated
  // client types this as `Date | null` rather than `Date | null | undefined`.
  @ApiProperty({
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
