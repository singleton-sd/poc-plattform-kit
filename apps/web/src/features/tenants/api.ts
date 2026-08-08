import type { TenantResponseDto } from '@poc-plattform-kit/api-client';

/** Narrows an Orval `{ data, status, headers }` response envelope to a single tenant. */
export function tenantPayload(response: unknown): TenantResponseDto | null {
  if (!response || typeof response !== 'object') return null;
  const data = (response as { data?: unknown }).data;
  if (!data || typeof data !== 'object') return null;
  const tenant = data as Partial<TenantResponseDto>;
  if (
    typeof tenant.id !== 'string' ||
    typeof tenant.name !== 'string' ||
    typeof tenant.slug !== 'string'
  ) {
    return null;
  }
  return tenant as TenantResponseDto;
}

/** Narrows an Orval `{ data, status, headers }` response envelope to a tenant list. */
export function tenantListPayload(response: unknown): TenantResponseDto[] | null {
  if (!response || typeof response !== 'object') return null;
  const data = (response as { data?: unknown }).data;
  return Array.isArray(data) ? (data as TenantResponseDto[]) : null;
}

export function errorStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object' || !('status' in error)) return null;
  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' ? status : null;
}

/** Prefers the backend's Nest exception message (e.g. "Tenant slug already exists"). */
export function errorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== 'object') return fallback;
  const data = (error as { data?: unknown }).data;
  if (!data || typeof data !== 'object' || !('message' in data)) return fallback;
  const message = (data as { message?: unknown }).message;
  if (typeof message === 'string') return message;
  if (Array.isArray(message) && message.every((entry) => typeof entry === 'string')) {
    return message.join(', ');
  }
  return fallback;
}
