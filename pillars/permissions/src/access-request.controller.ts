import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOAuth2,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '@poc-plattform-kit/pillar-single-sign-on';
import { AccessRequestService, type AccessRequestRecord } from './access-request.service';
import { CurrentUser } from './current-user.decorator';
import { AccessRequestListResponseDto } from './dto/access-request-list-response.dto';
import { AccessRequestResponseDto } from './dto/access-request-response.dto';
import { ApproveAccessRequestDto } from './dto/approve-access-request.dto';
import { CreateAccessRequestDto } from './dto/create-access-request.dto';
import { DenyAccessRequestDto } from './dto/deny-access-request.dto';

function toResponse(row: AccessRequestRecord): AccessRequestResponseDto {
  return {
    id: row.id,
    tenantId: row.tenantId,
    requesterId: row.requesterId,
    requesterEntraOid: row.requesterEntraOid,
    action: row.action,
    resource: row.resource,
    status: row.status,
    decidedById: row.decidedById,
    decidedAt: row.decidedAt?.toISOString() ?? null,
    denyReason: row.denyReason,
    grantType: row.grantType,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@ApiTags('permissions')
@ApiBearerAuth()
@ApiOAuth2([])
@Controller('permissions/access-requests')
export class AccessRequestController {
  constructor(private readonly accessRequests: AccessRequestService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create an access request for a denied action',
    description:
      'Captures subject/action/resource for the current user. Publishes permission.access_requested (outbox) so Notifications can alert eligible approvers.',
  })
  @ApiCreatedResponse({ type: AccessRequestResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid session/JWT.' })
  async create(
    @Body() dto: CreateAccessRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AccessRequestResponseDto> {
    return toResponse(await this.accessRequests.create(dto, user));
  }

  @Get('pending')
  @ApiOperation({
    summary: 'List pending access requests visible to the caller',
    description:
      'Returns pending requests in the caller tenant where the caller is a tenant admin (OpenFGA) or the requester’s direct manager chain member.',
  })
  @ApiOkResponse({ type: AccessRequestListResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid session/JWT.' })
  async listPending(@CurrentUser() user: AuthenticatedUser): Promise<AccessRequestListResponseDto> {
    const items = await this.accessRequests.listPendingForApprover(user);
    return { items: items.map(toResponse) };
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Approve an access request and grant the permission',
    description:
      'Caller must be an eligible approver. On success calls Grant API with the chosen grant type and notifies the requester via outbox events.',
  })
  @ApiOkResponse({ type: AccessRequestResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid session/JWT.' })
  async approve(
    @Param('id') id: string,
    @Body() dto: ApproveAccessRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AccessRequestResponseDto> {
    return toResponse(await this.accessRequests.approve(id, dto, user));
  }

  @Post(':id/deny')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Deny an access request',
    description: 'Caller must be an eligible approver. Optional reason is stored and published.',
  })
  @ApiOkResponse({ type: AccessRequestResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid session/JWT.' })
  async deny(
    @Param('id') id: string,
    @Body() dto: DenyAccessRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AccessRequestResponseDto> {
    return toResponse(await this.accessRequests.deny(id, dto, user));
  }
}
