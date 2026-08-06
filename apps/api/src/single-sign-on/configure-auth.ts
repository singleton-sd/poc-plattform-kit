import { ExpressAuth, getSession } from '@auth/express';
import type { Express, NextFunction, Request, Response } from 'express';
import { buildAuthConfig } from './auth.config';
import { mapAuthJsUserToAuthenticatedUser } from './map-authjs-user';

export function configureSingleSignOnAuth(expressApp: Express): void {
  const config = buildAuthConfig();
  if (!config) {
    return;
  }

  expressApp.set('trust proxy', true);
  expressApp.use('/api/auth', ExpressAuth(config));

  expressApp.use(async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const session = await getSession(req, config);
      const user = session?.user;
      if (user && typeof user === 'object') {
        const authUser = mapAuthJsUserToAuthenticatedUser(
          user as Record<string, unknown>,
        );
        if (authUser) {
          (req as Request & { authUser?: unknown }).authUser = authUser;
        }
      }
    } catch {
      // Treat session read failures as signed-out.
    }
    next();
  });
}