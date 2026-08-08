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
  @ApiCreatedResponse({ type: TenantResponseDto, description: 'Tenant created.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid session/JWT.' })
  create(@Body() dto: CreateTenantDto) {
    return this.tenants.create(dto);
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
