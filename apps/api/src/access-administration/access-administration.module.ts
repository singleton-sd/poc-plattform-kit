import { Module } from '@nestjs/common';
import { PermissionsModule } from '@poc-plattform-kit/pillar-permissions';
import { TenantModule } from '@poc-plattform-kit/pillar-tenant';
import { SingleSignOnModule } from '../single-sign-on/single-sign-on.module';
import { AccessAdministrationController } from './access-administration.controller';
import { AccessAdministrationService } from './access-administration.service';
import { TenantGroupAccessReader } from './tenant-group-access.reader';

@Module({
  imports: [PermissionsModule, TenantModule, SingleSignOnModule],
  controllers: [AccessAdministrationController],
  providers: [AccessAdministrationService, TenantGroupAccessReader],
})
export class AccessAdministrationModule {}
