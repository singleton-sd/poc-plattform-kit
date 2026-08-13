import { PartialType } from '@nestjs/swagger';
import { CreateTenantGroupDto } from './create-tenant-group.dto';

export class UpdateTenantGroupDto extends PartialType(CreateTenantGroupDto) {}
