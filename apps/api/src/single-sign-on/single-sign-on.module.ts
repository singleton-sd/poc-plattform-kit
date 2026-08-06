import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
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
    { provide: APP_GUARD, useClass: SessionOrJwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [JwtAuthGuard, SessionOrJwtAuthGuard, RolesGuard],
})
export class SingleSignOnModule {}
