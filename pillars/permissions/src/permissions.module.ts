import { Module } from '@nestjs/common';
import { AccessRequestController } from './access-request.controller';
import { AccessRequestService } from './access-request.service';
import { ManagerChainService } from './manager-chain.service';
import { PermissionsController } from './permissions.controller';
import { PermissionsService } from './permissions.service';

@Module({
  controllers: [PermissionsController, AccessRequestController],
  providers: [PermissionsService, ManagerChainService, AccessRequestService],
  exports: [PermissionsService, ManagerChainService, AccessRequestService],
})
export class PermissionsModule {}
