import {
  accessRequestControllerCreate,
  accessRequestControllerListMine,
  permissionsControllerCheck,
  type AccessRequestResponseDto,
  type CheckPermissionResponseDto,
  type CreateAccessRequestDto,
} from '@poc-plattform-kit/api-client';

type Envelope<T> = { data: T; status: number };

function unwrapData<T>(response: unknown): T {
  if (response && typeof response === 'object' && 'data' in response) {
    return (response as Envelope<T>).data;
  }
  return response as T;
}

export async function checkPermission(input: {
  subject: string;
  action: string;
  resource: string;
}): Promise<CheckPermissionResponseDto> {
  const response = await permissionsControllerCheck(input);
  return unwrapData<CheckPermissionResponseDto>(response);
}

export async function listMyAccessRequests(params: {
  action?: string;
  resource?: string;
}): Promise<AccessRequestResponseDto[]> {
  const response = await accessRequestControllerListMine(params);
  const body = unwrapData<{ items?: AccessRequestResponseDto[] }>(response);
  return body.items ?? [];
}

export async function createAccessRequest(
  body: CreateAccessRequestDto,
): Promise<AccessRequestResponseDto> {
  const response = await accessRequestControllerCreate(body);
  return unwrapData<AccessRequestResponseDto>(response);
}
