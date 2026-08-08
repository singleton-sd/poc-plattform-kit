import { Module } from '@nestjs/common';
import { ManagerChainService } from './manager-chain.service';
import { PermissionsController } from './permissions.controller';
import { PermissionsService } from './permissions.service';

@Module({
  controllers: [PermissionsController],
  providers: [PermissionsService, ManagerChainService],
  exports: [PermissionsService, ManagerChainService],
})
export class PermissionsModule {}
