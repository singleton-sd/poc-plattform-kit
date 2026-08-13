import { Controller, Delete, Get, Headers, Param, Put, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOAuth2,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiPreconditionFailedResponse,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '@poc-plattform-kit/pillar-single-sign-on';
import { CurrentUser } from '../single-sign-on/current-user.decorator';
import { AccessAdministrationService } from './access-administration.service';
import { AccessAdministrationResponseDto } from './dto/access-administration-response.dto';
import { ListAccessAdministrationQueryDto } from './dto/list-access-administration-query.dto';
import { RoleAssignmentCommandResponseDto } from './dto/role-assignment-command-response.dto';
import { RoleAssignmentService } from './role-assignment.service';

@ApiTags('tenant access administration')
@ApiBearerAuth()
@ApiOAuth2([])
@Controller('tenants/:tenantId/access-administration')
export class AccessAdministrationController {
  constructor(
    private readonly accessAdministration: AccessAdministrationService,
    private readonly roleAssignments: RoleAssignmentService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List a tenant access administration projection',
    description:
      'Returns tenant members, canonical role and permission catalogs, and direct/group/effective assignment provenance. Requires an OpenFGA tenant admin decision for the exact tenant.',
  })
  @ApiHeader({
    name: 'x-tenant-id',
    required: false,
    description: 'Legacy/dev tenant context; when present it must match tenantId.',
  })
  @ApiOkResponse({ type: AccessAdministrationResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid session/JWT or tenant context.' })
  @ApiForbiddenResponse({ description: 'Permission denied without revealing tenant existence.' })
  list(
    @Param('tenantId') tenantId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListAccessAdministrationQueryDto,
  ): Promise<AccessAdministrationResponseDto> {
    return this.accessAdministration.list(tenantId, actor, query);
  }

  @Put('users/:userId/roles/:roleId')
  @ApiOkResponse({ type: RoleAssignmentCommandResponseDto })
  @RoleCommandDocs()
  assignUser(
    @Param('tenantId') tenantId: string,
    @Param('userId') userId: string,
    @Param('roleId') roleId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('if-match') ifMatch?: string,
  ) {
    return this.roleAssignments.execute({
      tenantId,
      principalType: 'user',
      principalId: userId,
      roleId,
      assigned: true,
      actor,
      idempotencyKey,
      ifMatch,
    });
  }

  @Delete('users/:userId/roles/:roleId')
  @ApiOkResponse({ type: RoleAssignmentCommandResponseDto })
  @RoleCommandDocs()
  revokeUser(
    @Param('tenantId') tenantId: string,
    @Param('userId') userId: string,
    @Param('roleId') roleId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('if-match') ifMatch?: string,
  ) {
    return this.roleAssignments.execute({
      tenantId,
      principalType: 'user',
      principalId: userId,
      roleId,
      assigned: false,
      actor,
      idempotencyKey,
      ifMatch,
    });
  }

  @Put('groups/:groupId/roles/:roleId')
  @ApiOkResponse({ type: RoleAssignmentCommandResponseDto })
  @RoleCommandDocs()
  assignGroup(
    @Param('tenantId') tenantId: string,
    @Param('groupId') groupId: string,
    @Param('roleId') roleId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('if-match') ifMatch?: string,
  ) {
    return this.roleAssignments.execute({
      tenantId,
      principalType: 'group',
      principalId: groupId,
      roleId,
      assigned: true,
      actor,
      idempotencyKey,
      ifMatch,
    });
  }

  @Delete('groups/:groupId/roles/:roleId')
  @ApiOkResponse({ type: RoleAssignmentCommandResponseDto })
  @RoleCommandDocs()
  revokeGroup(
    @Param('tenantId') tenantId: string,
    @Param('groupId') groupId: string,
    @Param('roleId') roleId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('if-match') ifMatch?: string,
  ) {
    return this.roleAssignments.execute({
      tenantId,
      principalType: 'group',
      principalId: groupId,
      roleId,
      assigned: false,
      actor,
      idempotencyKey,
      ifMatch,
    });
  }
}

function RoleCommandDocs(): MethodDecorator {
  return (target, propertyKey, descriptor) => {
    ApiHeader({ name: 'Idempotency-Key', required: true })(target, propertyKey!, descriptor!);
    ApiHeader({ name: 'If-Match', required: true })(target, propertyKey!, descriptor!);
    ApiBadRequestResponse({ description: 'Malformed headers or unknown role.' })(
      target,
      propertyKey!,
      descriptor!,
    );
    ApiUnauthorizedResponse()(target, propertyKey!, descriptor!);
    ApiForbiddenResponse({ description: 'Permission denied.' })(target, propertyKey!, descriptor!);
    ApiNotFoundResponse({ description: 'Tenant-safe principal not found.' })(
      target,
      propertyKey!,
      descriptor!,
    );
    ApiConflictResponse({ description: 'Idempotency key conflict or owner invariant.' })(
      target,
      propertyKey!,
      descriptor!,
    );
    ApiPreconditionFailedResponse({ description: 'Stale If-Match.' })(
      target,
      propertyKey!,
      descriptor!,
    );
    ApiServiceUnavailableResponse({ description: 'OpenFGA synchronization pending.' })(
      target,
      propertyKey!,
      descriptor!,
    );
  };
}
