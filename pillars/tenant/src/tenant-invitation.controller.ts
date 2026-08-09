import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOAuth2,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '@poc-plattform-kit/pillar-single-sign-on';
import { CurrentUser } from './current-user.decorator';
import { CreateTenantInvitationDto } from './dto/create-tenant-invitation.dto';
import { TenantInvitationResponseDto } from './dto/tenant-invitation-response.dto';
import { TenantInvitationService } from './tenant-invitation.service';

const COARSE_GUARD_DESCRIPTION =
  'Coarse guard (temporary, see Permissions pillar epic): requires the global ' +
  'tenant-admin/support-agent role, or a TenantMembership with role "owner" on this tenant.';

@ApiTags('tenant-invitations')
@ApiBearerAuth()
@ApiOAuth2([])
@Controller('tenants/:tenantId/invitations')
export class TenantInvitationController {
  constructor(private readonly invitations: TenantInvitationService) {}

  @Post()
  @ApiCreatedResponse({
    type: TenantInvitationResponseDto,
    description: 'Pending invitation created; emits tenant.invitation_created for Notifications.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid session/JWT.' })
  @ApiForbiddenResponse({ description: COARSE_GUARD_DESCRIPTION })
  @ApiConflictResponse({ description: 'A pending invitation already exists for this email.' })
  create(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateTenantInvitationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.invitations.create(tenantId, dto, user);
  }

  @Get()
  @ApiOkResponse({
    type: TenantInvitationResponseDto,
    isArray: true,
    description: 'All invitations for the tenant, any status, oldest first.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid session/JWT.' })
  @ApiForbiddenResponse({ description: COARSE_GUARD_DESCRIPTION })
  findAll(@Param('tenantId') tenantId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.invitations.findAllForTenant(tenantId, user);
  }

  @Delete(':invitationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Pending invitation revoked.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid session/JWT.' })
  @ApiForbiddenResponse({ description: COARSE_GUARD_DESCRIPTION })
  @ApiNotFoundResponse({ description: 'Invitation not found for this tenant.' })
  @ApiConflictResponse({ description: 'Only pending invitations can be revoked.' })
  revoke(
    @Param('tenantId') tenantId: string,
    @Param('invitationId') invitationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.invitations.revoke(tenantId, invitationId, user);
  }
}
