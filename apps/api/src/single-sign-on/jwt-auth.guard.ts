import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser>(err: Error | null, user: TUser): TUser {
    if (err || !user) {
      throw err ?? new UnauthorizedException('Unauthorized');
    }
    return user;
  }
}

@Injectable()
export class SessionOrJwtAuthGuard implements CanActivate {
  constructor(private readonly jwtGuard: JwtAuthGuard) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: unknown;
      authUser?: unknown;
    }>();

    if (req.authUser) {
      req.user = req.authUser;
      return true;
    }

    const auth = req.headers.authorization;
    if (auth?.toLowerCase().startsWith('bearer ')) {
      const ok = await this.jwtGuard.canActivate(context);
      return ok === true;
    }

    throw new UnauthorizedException('Unauthorized');
  }
}
