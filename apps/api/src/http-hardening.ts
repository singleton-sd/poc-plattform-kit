import type { ExecutionContext } from '@nestjs/common';

export interface ThrottleConfig {
  ttl: number;
  limit: number;
  generateKey: typeof generateApiThrottleKey;
}

type ThrottleEnvironment = Partial<
  Record<'API_THROTTLE_TTL_MS' | 'API_THROTTLE_LIMIT', string | undefined>
>;

function positiveInteger(
  name: keyof ThrottleEnvironment,
  value: string | undefined,
  fallback: number,
) {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

export function generateApiThrottleKey(
  _context: ExecutionContext,
  tracker: string,
  throttlerName: string,
): string {
  return `${throttlerName}:${tracker}`;
}

export function buildThrottleConfig(env: ThrottleEnvironment = process.env): ThrottleConfig {
  return {
    ttl: positiveInteger('API_THROTTLE_TTL_MS', env.API_THROTTLE_TTL_MS, 60_000),
    limit: positiveInteger('API_THROTTLE_LIMIT', env.API_THROTTLE_LIMIT, 100),
    generateKey: generateApiThrottleKey,
  };
}
