import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiHeader, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { TenantResponseDto } from './dto/tenant-response.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { TenantService } from './tenant.service';

@ApiTags('tenants')
@Controller('tenants')
export class TenantController {
  constructor(private readonly tenants: TenantService) {}

  @Post()
  @ApiCreatedResponse({ type: TenantResponseDto, description: 'Tenant created.' })
  create(@Body() dto: CreateTenantDto) {
    return this.tenants.create(dto);
  }

  @Get(':id')
  @ApiHeader({ name: 'x-tenant-id', required: true })
  @ApiOkResponse({
    type: TenantResponseDto,
    description: 'Tenant by id (requires matching x-tenant-id).',
  })
  findOne(@Param('id') id: string) {
    return this.tenants.findOne(id);
  }

  @Patch(':id')
  @ApiHeader({ name: 'x-tenant-id', required: true })
  @ApiOkResponse({
    type: TenantResponseDto,
    description: 'Tenant updated (requires matching x-tenant-id).',
  })
  update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.tenants.update(id, dto);
  }
}
