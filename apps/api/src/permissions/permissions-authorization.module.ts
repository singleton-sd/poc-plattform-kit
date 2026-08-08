import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PermissionsModule } from '@poc-plattform-kit/pillar-permissions';
import { PermissionsGuard } from './permissions.guard';

@Module({
  imports: [PermissionsModule],
  providers: [PermissionsGuard, { provide: APP_GUARD, useExisting: PermissionsGuard }],
})
export class PermissionsAuthorizationModule {}
