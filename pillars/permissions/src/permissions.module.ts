import { Global, Module } from '@nestjs/common';
import { AccessRequestController } from './access-request.controller';
import { AccessRequestService } from './access-request.service';
import { ManagerChainService } from './manager-chain.service';
import { PermissionsController } from './permissions.controller';
import { PermissionsService } from './permissions.service';

export const TENANT_GROUP_PERMISSIONS = 'TENANT_GROUP_PERMISSIONS';

@Global()
@Module({
  controllers: [PermissionsController, AccessRequestController],
  providers: [
    PermissionsService,
    ManagerChainService,
    AccessRequestService,
    { provide: TENANT_GROUP_PERMISSIONS, useExisting: PermissionsService },
  ],
  exports: [
    PermissionsService,
    ManagerChainService,
    AccessRequestService,
    TENANT_GROUP_PERMISSIONS,
  ],
})
export class PermissionsModule {}
