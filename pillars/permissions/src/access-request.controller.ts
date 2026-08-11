import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiGoneResponse,
  ApiNotFoundResponse,
  ApiOAuth2,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '@poc-plattform-kit/pillar-single-sign-on';
import { AccessRequestService } from './access-request.service';
import { toAccessRequestResponseDto } from './access-request.mapper';
import { CurrentUser } from './current-user.decorator';
import { AccessRequestListResponseDto } from './dto/access-request-list-response.dto';
import { AccessRequestResponseDto } from './dto/access-request-response.dto';
import { ApproveAccessRequestDto } from './dto/approve-access-request.dto';
import { CreateAccessRequestDto } from './dto/create-access-request.dto';
import { DenyAccessRequestDto } from './dto/deny-access-request.dto';
import { ListMyAccessRequestsQueryDto } from './dto/list-my-access-requests-query.dto';

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
      'Captures subject/action/resource for the current user. Idempotent for an existing non-expired pending request on the same action+resource. Publishes permission.access_requested (outbox) so Notifications can alert eligible approvers.',
  })
  @ApiCreatedResponse({ type: AccessRequestResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed or tenant claim missing.' })
  @ApiForbiddenResponse({ description: 'Body tenantId is not a tenant the caller belongs to.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid session/JWT.' })
  async create(
    @Body() dto: CreateAccessRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AccessRequestResponseDto> {
    return toAccessRequestResponseDto(await this.accessRequests.create(dto, user));
  }

  @Get('mine')
  @ApiOperation({
    summary: 'List access requests filed by the current user',
    description: 'Optional action/resource filters. Newest first (max 50).',
  })
  @ApiOkResponse({ type: AccessRequestListResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid session/JWT.' })
  async listMine(
    @Query() query: ListMyAccessRequestsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AccessRequestListResponseDto> {
    const items = await this.accessRequests.listMine(user, query);
    return { items: items.map(toAccessRequestResponseDto) };
  }

  @Get('pending')
  @ApiOperation({
    summary: 'List pending access requests visible to the caller',
    description:
      'Returns non-expired pending requests in the caller tenant where the caller is a tenant admin (OpenFGA) or the requester’s manager chain member. Does not mutate expired rows.',
  })
  @ApiOkResponse({ type: AccessRequestListResponseDto })
  @ApiBadRequestResponse({ description: 'Session has no tenant claim.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid session/JWT.' })
  async listPending(@CurrentUser() user: AuthenticatedUser): Promise<AccessRequestListResponseDto> {
    const items = await this.accessRequests.listPendingForApprover(user);
    return { items: items.map(toAccessRequestResponseDto) };
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Approve an access request and grant the permission',
    description:
      'Caller must be a same-tenant eligible approver (not the requester). Claims the row, then calls Grant API; rolls back / revokes on failure.',
  })
  @ApiOkResponse({ type: AccessRequestResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid grant payload or grant declined.' })
  @ApiForbiddenResponse({ description: 'Not an eligible approver or self-approval.' })
  @ApiNotFoundResponse({ description: 'Access request not found.' })
  @ApiGoneResponse({ description: 'Pending request expired.' })
  @ApiConflictResponse({ description: 'Concurrent decide already claimed the request.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid session/JWT.' })
  async approve(
    @Param('id') id: string,
    @Body() dto: ApproveAccessRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AccessRequestResponseDto> {
    return toAccessRequestResponseDto(await this.accessRequests.approve(id, dto, user));
  }

  @Post(':id/deny')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Deny an access request',
    description: 'Caller must be a same-tenant eligible approver (not the requester).',
  })
  @ApiOkResponse({ type: AccessRequestResponseDto })
  @ApiBadRequestResponse({ description: 'Request is not pending.' })
  @ApiForbiddenResponse({ description: 'Not an eligible approver or self-denial.' })
  @ApiNotFoundResponse({ description: 'Access request not found.' })
  @ApiGoneResponse({ description: 'Pending request expired.' })
  @ApiConflictResponse({ description: 'Concurrent decide already claimed the request.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid session/JWT.' })
  async deny(
    @Param('id') id: string,
    @Body() dto: DenyAccessRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AccessRequestResponseDto> {
    return toAccessRequestResponseDto(await this.accessRequests.deny(id, dto, user));
  }
}
