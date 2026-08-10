import {
  accessRequestControllerCreate,
  accessRequestControllerListMine,
  permissionsControllerCheck,
  type AccessRequestResponseDto,
  type ApiFetchError,
  type CheckPermissionResponseDto,
  type CreateAccessRequestDto,
} from '@poc-plattform-kit/api-client';

type Envelope = {
  data?: unknown;
  status?: number;
};

function isEnvelope(response: unknown): response is Envelope {
  return Boolean(response && typeof response === 'object' && 'status' in response);
}

function toApiError(status: number, data: unknown, fallback: string): ApiFetchError {
  const error = new Error(fallback) as ApiFetchError;
  error.status = status;
  error.data = data;
  return error;
}

/**
 * Unwraps an Orval `{ data, status }` envelope.
 * Throws when status is missing/non-2xx or the payload is absent.
 * (`customFetch` already throws on HTTP errors; this guards typed unions /
 * unexpected shapes so callers never read `.items` on undefined.)
 */
export function unwrapData<T>(response: unknown, fallbackMessage: string): T {
  if (!isEnvelope(response)) {
    if (response === undefined || response === null) {
      throw toApiError(0, response, fallbackMessage);
    }
    return response as T;
  }

  const status = response.status;
  if (typeof status !== 'number' || status < 200 || status >= 300) {
    throw toApiError(
      typeof status === 'number' ? status : 0,
      response.data,
      `${fallbackMessage} (HTTP ${String(status ?? 'unknown')})`,
    );
  }

  if (response.data === undefined || response.data === null) {
    throw toApiError(status, response.data, fallbackMessage);
  }

  return response.data as T;
}

/** Prefers Nest exception `message` when present on ApiFetchError.data. */
export function formatApiError(error: unknown, fallback: string): string {
  if (!error || typeof error !== 'object') return fallback;
  const data = (error as { data?: unknown }).data;
  if (data && typeof data === 'object' && 'message' in data) {
    const message = (data as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
    if (Array.isArray(message) && message.every((entry) => typeof entry === 'string')) {
      return message.join(', ');
    }
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

export async function checkPermission(input: {
  subject: string;
  action: string;
  resource: string;
}): Promise<CheckPermissionResponseDto> {
  const response = await permissionsControllerCheck(input);
  return unwrapData<CheckPermissionResponseDto>(response, 'Permission check failed');
}

export async function listMyAccessRequests(params: {
  action?: string;
  resource?: string;
}): Promise<AccessRequestResponseDto[]> {
  const response = await accessRequestControllerListMine(params);
  const body = unwrapData<{ items?: AccessRequestResponseDto[] }>(
    response,
    'Could not load access requests',
  );
  return Array.isArray(body.items) ? body.items : [];
}

export async function createAccessRequest(
  body: CreateAccessRequestDto,
): Promise<AccessRequestResponseDto> {
  const response = await accessRequestControllerCreate(body);
  return unwrapData<AccessRequestResponseDto>(response, 'Could not create access request');
}
