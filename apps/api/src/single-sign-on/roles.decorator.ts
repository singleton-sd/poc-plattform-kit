import { SetMetadata } from '@nestjs/common';

/** Shared with `pillars/tenant` Roles decorator — keep the string in sync. */
export const ROLES_KEY = 'roles';

/** Require one of the listed coarse Entra app roles (e.g. tenant-admin, support-agent). */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
