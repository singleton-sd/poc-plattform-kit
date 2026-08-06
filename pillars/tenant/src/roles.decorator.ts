import { SetMetadata } from '@nestjs/common';

/** Must match `ROLES_KEY` in apps/api RolesGuard. */
export const ROLES_KEY = 'roles';

/** Require one of the listed coarse Entra app roles. */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
