import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { EntraJwtStrategy } from './entra-jwt.strategy';
import { JwtAuthGuard, SessionOrJwtAuthGuard } from './jwt-auth.guard';
import { SingleSignOnController } from './single-sign-on.controller';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [SingleSignOnController],
  providers: [EntraJwtStrategy, JwtAuthGuard, SessionOrJwtAuthGuard],
  exports: [JwtAuthGuard, SessionOrJwtAuthGuard],
})
export class SingleSignOnModule {}
