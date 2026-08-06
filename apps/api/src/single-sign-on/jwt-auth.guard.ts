import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from './public.decorator';
import { isPublicPath } from './public-paths';

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
  constructor(
    private readonly jwtGuard: JwtAuthGuard,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.isPublic(context)) {
      return true;
    }

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

  private isPublic(context: ExecutionContext): boolean {
    const metaPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (metaPublic) {
      return true;
    }

    const req = context.switchToHttp().getRequest<{
      originalUrl?: string;
      url?: string;
      path?: string;
    }>();
    const path = req.originalUrl ?? req.url ?? req.path ?? '';
    return isPublicPath(path);
  }
}
