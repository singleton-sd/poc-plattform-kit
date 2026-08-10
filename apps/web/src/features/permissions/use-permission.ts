'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AccessRequestResponseDto,
  CreateAccessRequestDto,
} from '@poc-plattform-kit/api-client';
import { useMe } from '@/features/auth/me';
import { checkPermission, createAccessRequest, formatApiError, listMyAccessRequests } from './api';

export type UsePermissionArgs = {
  action: string;
  resource: string;
  enabled?: boolean;
};

export const permissionKeys = {
  check: (subject: string, action: string, resource: string) =>
    ['permissions', 'check', subject, action, resource] as const,
  mine: (action: string, resource: string) =>
    ['permissions', 'access-requests', 'mine', action, resource] as const,
};

export function usePermission({ action, resource, enabled = true }: UsePermissionArgs) {
  const me = useMe();
  const subject = me.data?.id ? `user:${me.data.id}` : '';
  const ready = Boolean(enabled && subject && action && resource);

  const checkQuery = useQuery({
    queryKey: permissionKeys.check(subject, action, resource),
    queryFn: () => checkPermission({ subject, action, resource }),
    enabled: ready,
    staleTime: 30_000,
  });

  const mineQuery = useQuery({
    queryKey: permissionKeys.mine(action, resource),
    queryFn: () => listMyAccessRequests({ action, resource }),
    enabled: ready && checkQuery.data?.allowed === false,
    staleTime: 15_000,
  });

  const latestRequest: AccessRequestResponseDto | null = mineQuery.data?.[0] ?? null;
  const pendingRequest =
    latestRequest?.status === 'pending' || latestRequest?.status === 'approving'
      ? latestRequest
      : null;

  return {
    subject,
    isLoading: me.isLoading || (ready && checkQuery.isLoading),
    isError: checkQuery.isError,
    errorMessage: checkQuery.isError
      ? formatApiError(checkQuery.error, 'Could not verify permission. Try again.')
      : null,
    allowed: checkQuery.data?.allowed === true,
    denied: checkQuery.data?.allowed === false,
    latestRequest,
    pendingRequest,
    refetch: async () => {
      await Promise.all([checkQuery.refetch(), mineQuery.refetch()]);
    },
  };
}

export function useRequestAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateAccessRequestDto) => createAccessRequest(body),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({
        queryKey: permissionKeys.mine(created.action, created.resource),
      });
    },
  });
}

export function requestAccessErrorMessage(error: unknown): string {
  return formatApiError(error, 'Could not submit the request. Try again.');
}
