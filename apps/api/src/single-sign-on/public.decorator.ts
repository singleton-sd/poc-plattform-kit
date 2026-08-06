import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Mark a Nest route as reachable without Auth.js session or Bearer JWT. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
