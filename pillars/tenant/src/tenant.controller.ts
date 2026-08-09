import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOAuth2,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '@poc-plattform-kit/pillar-single-sign-on';
import { CurrentUser } from './current-user.decorator';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { ListTenantsQueryDto } from './dto/list-tenants-query.dto';
import { TenantListResponseDto } from './dto/tenant-list-response.dto';
import { TenantResponseDto } from './dto/tenant-response.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { Roles } from './roles.decorator';
import { TenantService } from './tenant.service';

@ApiTags('tenants')
@ApiBearerAuth()
@ApiOAuth2([])
@Controller('tenants')
export class TenantController {
  constructor(private readonly tenants: TenantService) {}

  @Get()
  @Roles('support-agent')
  @ApiOkResponse({
    type: TenantListResponseDto,
    description: 'A page of tenants matching the optional name or slug search.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid session/JWT.' })
  @ApiForbiddenResponse({ description: 'Requires the support-agent role.' })
  findAll(@Query() query: ListTenantsQueryDto) {
    return this.tenants.findAll(query);
  }

  @Post()
  @Roles('support-agent', 'tenant-admin')
  @ApiCreatedResponse({
    type: TenantResponseDto,
    description: 'Tenant created; the caller is auto-assigned as its owner.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid session/JWT.' })
  create(@Body() dto: CreateTenantDto, @CurrentUser() user: AuthenticatedUser) {
    // AuthenticatedUser.id falls back to the Entra oid until a local User row
    // exists for this session (see mapEntraClaims) -- no call site anywhere
    // in the app passes localUserId today, so this stores that oid, same as
    // every other consumer of AuthenticatedUser.id (e.g. GET /api/me).
    // "Persist SSO User locally on sign-in" (ClickUp 86d3zbugm) is the
    // tracked ticket that starts populating real local User.id values; no
    // membership-specific fix belongs here.
    return this.tenants.create(dto, user.id);
  }

  @Get(':id')
  @ApiHeader({
    name: 'x-tenant-id',
    required: false,
    description:
      'Legacy/dev tenancy escape when the token has no tenant_id claim. Claim wins when both are present.',
  })
  @ApiOkResponse({
    type: TenantResponseDto,
    description: 'Tenant by id (requires matching tenancy context).',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid session/JWT.' })
  findOne(@Param('id') id: string) {
    return this.tenants.findOne(id);
  }

  @Patch(':id')
  @Roles('tenant-admin')
  @ApiHeader({
    name: 'x-tenant-id',
    required: false,
    description:
      'Legacy/dev tenancy escape when the token has no tenant_id claim. Claim wins when both are present.',
  })
  @ApiOkResponse({
    type: TenantResponseDto,
    description: 'Tenant updated after AuthN, tenancy, role, and Permissions AuthZ checks.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid session/JWT.' })
  @ApiForbiddenResponse({
    description: 'Requires tenant-admin role and Permissions tuple user:<id>, update, tenant:<id>.',
  })
  update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.tenants.update(id, dto);
  }
}
