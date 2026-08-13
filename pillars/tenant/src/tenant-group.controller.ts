import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOAuth2,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '@poc-plattform-kit/pillar-single-sign-on';
import { CurrentUser } from './current-user.decorator';
import { AddTenantGroupMemberDto } from './dto/add-tenant-group-member.dto';
import { CreateTenantGroupDto } from './dto/create-tenant-group.dto';
import { TenantGroupMembershipResponseDto } from './dto/tenant-group-membership-response.dto';
import { TenantGroupResponseDto } from './dto/tenant-group-response.dto';
import { UpdateTenantGroupDto } from './dto/update-tenant-group.dto';
import { TenantGroupService } from './tenant-group.service';

const MANAGER_DESCRIPTION = 'Requires tenant-admin or an owner membership on the target tenant.';

@ApiTags('tenant-groups')
@ApiBearerAuth()
@ApiOAuth2([])
@Controller('tenants/:tenantId/groups')
export class TenantGroupController {
  constructor(private readonly groups: TenantGroupService) {}

  @Get()
  @ApiOkResponse({ type: TenantGroupResponseDto, isArray: true })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse({ description: MANAGER_DESCRIPTION })
  list(@Param('tenantId') tenantId: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.groups.list(tenantId, actor);
  }

  @Post()
  @ApiCreatedResponse({ type: TenantGroupResponseDto })
  @ApiForbiddenResponse({ description: MANAGER_DESCRIPTION })
  @ApiConflictResponse({ description: 'A group with the same name already exists.' })
  create(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateTenantGroupDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.groups.create(tenantId, dto, actor);
  }

  @Patch(':groupId')
  @ApiOkResponse({ type: TenantGroupResponseDto })
  @ApiNotFoundResponse({ description: 'Tenant group not found.' })
  @ApiConflictResponse({ description: 'A group with the same name already exists.' })
  update(
    @Param('tenantId') tenantId: string,
    @Param('groupId') groupId: string,
    @Body() dto: UpdateTenantGroupDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.groups.update(tenantId, groupId, dto, actor);
  }

  @Delete(':groupId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Tenant group not found.' })
  @ApiServiceUnavailableResponse({
    description: 'OpenFGA revocation failed; the local group remains unchanged.',
  })
  remove(
    @Param('tenantId') tenantId: string,
    @Param('groupId') groupId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.groups.remove(tenantId, groupId, actor);
  }

  @Get(':groupId/members')
  @ApiOkResponse({ type: TenantGroupMembershipResponseDto, isArray: true })
  listMembers(
    @Param('tenantId') tenantId: string,
    @Param('groupId') groupId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.groups.listMembers(tenantId, groupId, actor);
  }

  @Post(':groupId/members')
  @ApiCreatedResponse({ type: TenantGroupMembershipResponseDto })
  @ApiNotFoundResponse({ description: 'Group or tenant membership not found.' })
  @ApiServiceUnavailableResponse({
    description: 'Membership is recorded as failed/pending and is not effective in OpenFGA.',
  })
  addMember(
    @Param('tenantId') tenantId: string,
    @Param('groupId') groupId: string,
    @Body() dto: AddTenantGroupMemberDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.groups.addMember(tenantId, groupId, dto, actor);
  }

  @Delete(':groupId/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Group membership not found.' })
  @ApiServiceUnavailableResponse({
    description: 'OpenFGA revocation failed; local membership remains unchanged.',
  })
  removeMember(
    @Param('tenantId') tenantId: string,
    @Param('groupId') groupId: string,
    @Param('userId') userId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.groups.removeMember(tenantId, groupId, userId, actor);
  }
}
