import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AccessPermissionCatalogItemDto {
  @ApiProperty({ example: 'read' })
  id!: string;

  @ApiProperty({ example: 'Read' })
  name!: string;

  @ApiProperty()
  description!: string;
}

export class AccessRoleCatalogItemDto {
  @ApiProperty({ example: 'admin' })
  id!: string;

  @ApiProperty({ example: 'Admin' })
  name!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty({ type: [String], example: ['read', 'create', 'update', 'delete'] })
  permissionIds!: string[];
}

export class AccessAssignmentProvenanceDto {
  @ApiProperty({ enum: ['membership', 'direct', 'group'] })
  source!: 'membership' | 'direct' | 'group';

  @ApiProperty({ example: 'viewer' })
  roleId!: string;

  @ApiPropertyOptional({ example: 'engineering' })
  groupId?: string;
}

export class TenantAccessUserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  name!: string | null;

  @ApiProperty({ type: [String] })
  effectiveRoleIds!: string[];

  @ApiProperty({ type: [String] })
  effectivePermissionIds!: string[];

  @ApiProperty({ type: [AccessAssignmentProvenanceDto] })
  provenance!: AccessAssignmentProvenanceDto[];
}

export class AccessAdministrationResponseDto {
  @ApiProperty()
  tenantId!: string;

  @ApiProperty({ description: 'Opaque source versions used to build this read projection.' })
  consistencyVersion!: string;

  @ApiProperty({ type: [AccessRoleCatalogItemDto] })
  roles!: AccessRoleCatalogItemDto[];

  @ApiProperty({ type: [AccessPermissionCatalogItemDto] })
  permissions!: AccessPermissionCatalogItemDto[];

  @ApiProperty({ type: [TenantAccessUserDto] })
  users!: TenantAccessUserDto[];

  @ApiPropertyOptional({ nullable: true, type: String })
  nextCursor!: string | null;
}
