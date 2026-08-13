import { Injectable } from '@nestjs/common';

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
  async listMemberships(_tenantId: string): Promise<TenantGroupAccessProjection> {
    return { consistencyVersion: 'not-available', groups: [] };
  }
}
