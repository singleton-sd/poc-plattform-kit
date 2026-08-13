import { Injectable } from '@nestjs/common';
import { TenantGroupService } from '@poc-plattform-kit/pillar-tenant';

export type TenantGroupMemberProjection = {
  groupId: string;
  userIds: string[];
};

export type TenantGroupAccessProjection = {
  consistencyVersion: string;
  groups: TenantGroupMemberProjection[];
};

/**
 * Forward-compatible boundary for the independently delivered Tenant group
 * pillar. The current adapter is intentionally empty and owns no group schema.
 */
@Injectable()
export class TenantGroupAccessReader {
  constructor(private readonly tenantGroups: TenantGroupService) {}

  async listMemberships(tenantId: string): Promise<TenantGroupAccessProjection> {
    return this.tenantGroups.listAccessProjection(tenantId);
  }
}
