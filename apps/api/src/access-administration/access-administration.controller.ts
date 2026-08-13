import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOAuth2,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '@poc-plattform-kit/pillar-single-sign-on';
import { CurrentUser } from '../single-sign-on/current-user.decorator';
import { AccessAdministrationService } from './access-administration.service';
import { AccessAdministrationResponseDto } from './dto/access-administration-response.dto';
import { ListAccessAdministrationQueryDto } from './dto/list-access-administration-query.dto';

@ApiTags('tenant access administration')
@ApiBearerAuth()
@ApiOAuth2([])
@Controller('tenants/:tenantId/access-administration')
export class AccessAdministrationController {
  constructor(private readonly accessAdministration: AccessAdministrationService) {}

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
}
