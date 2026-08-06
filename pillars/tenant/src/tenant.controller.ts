import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { TenantResponseDto } from './dto/tenant-response.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { Roles } from './roles.decorator';
import { TenantService } from './tenant.service';

@ApiTags('tenants')
@ApiBearerAuth()
@Controller('tenants')
export class TenantController {
  constructor(private readonly tenants: TenantService) {}

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
    description: 'Tenant updated (requires matching tenancy context).',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid session/JWT.' })
  update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.tenants.update(id, dto);
  }
}
