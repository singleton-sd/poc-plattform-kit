import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { UserIdentityService } from '@poc-plattform-kit/pillar-single-sign-on';
import { EntraJwtStrategy } from './entra-jwt.strategy';
import { JwtAuthGuard, SessionOrJwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { SingleSignOnController } from './single-sign-on.controller';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [SingleSignOnController],
  providers: [
    EntraJwtStrategy,
    JwtAuthGuard,
    SessionOrJwtAuthGuard,
    RolesGuard,
    UserIdentityService,
    { provide: APP_GUARD, useClass: SessionOrJwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [JwtAuthGuard, SessionOrJwtAuthGuard, RolesGuard],
})
export class SingleSignOnModule {}
