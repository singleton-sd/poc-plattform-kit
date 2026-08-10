'use client';

import {
  useTenantControllerFindOne,
  useTenantControllerUpdate,
  type TenantResponseDto,
} from '@poc-plattform-kit/api-client';
import { useEffect } from 'react';
import { Drawer } from '@/components/drawer';
import { AlertIcon } from '@/components/icons';
import { PermissionGate } from '@/features/permissions/permission-gate';
import { configureApiClient } from '@/lib/api-client';
import { errorMessage, tenantPayload } from './api';
import { CopyTenantIdButton } from './copy-tenant-id-button';
import { UPDATE_TENANT_FORM_ID, UpdateTenantForm } from './update-tenant-form';

type TenantDetailsDrawerProps = {
  tenantId: string | null;
  onClose: () => void;
  onUpdated: (tenant: TenantResponseDto) => void;
};

const FALLBACK_ERROR = 'Could not save changes. Try again.';

export function TenantDetailsDrawer({ tenantId, onClose, onUpdated }: TenantDetailsDrawerProps) {
  const open = tenantId !== null;

  useEffect(() => {
    if (tenantId) configureApiClient({ tenantId });
  }, [tenantId]);

  const findQuery = useTenantControllerFindOne(tenantId ?? '', {
    query: { enabled: open, retry: false },
  });
  const updateMutation = useTenantControllerUpdate({
    mutation: {
      onSuccess: (response) => {
        const tenant = tenantPayload(response);
        if (tenant) onUpdated(tenant);
      },
    },
  });

  const { reset: resetUpdateMutation } = updateMutation;
  useEffect(() => {
    if (open) resetUpdateMutation();
  }, [open, tenantId, resetUpdateMutation]);

  const tenant = tenantPayload(findQuery.data);

  return (
    <Drawer
      open={open}
      title="Tenant details"
      onClose={onClose}
      testId="tenant-details-drawer"
      footer={
        tenant ? (
          <>
            <PermissionGate
              action="update"
              resource={`tenant:${tenant.id}`}
              tenantId={tenant.id}
              deniedControl={
                <button
                  type="button"
                  disabled
                  className="rounded bg-accent px-3 py-2 text-sm font-medium text-accent-on opacity-50"
                  data-testid="tenant-update-submit"
                  aria-disabled="true"
                >
                  Save Changes
                </button>
              }
            >
              <button
                type="submit"
                form={UPDATE_TENANT_FORM_ID}
                disabled={updateMutation.isPending}
                className="rounded bg-accent px-3 py-2 text-sm font-medium text-accent-on disabled:opacity-50"
                data-testid="tenant-update-submit"
              >
                {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
              </button>
            </PermissionGate>
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-fg-subtle px-3 py-2 text-sm text-fg"
            >
              Cancel
            </button>
          </>
        ) : null
      }
    >
      {findQuery.isFetching ? (
        <div className="flex flex-col gap-3" aria-hidden="true">
          <div className="h-4 w-1/3 animate-pulse rounded bg-bg-muted" />
          <div className="h-9 w-full animate-pulse rounded bg-bg-muted" />
          <div className="h-4 w-1/4 animate-pulse rounded bg-bg-muted" />
          <div className="h-9 w-full animate-pulse rounded bg-bg-muted" />
        </div>
      ) : null}

      {!findQuery.isFetching && findQuery.isError ? (
        <div className="flex flex-col items-start gap-3 text-sm text-fg" role="alert">
          <p className="flex items-center gap-2">
            <AlertIcon className="h-4 w-4 shrink-0" />
            Unable to load this tenant.
          </p>
          <button
            type="button"
            onClick={() => void findQuery.refetch()}
            className="rounded border border-fg-subtle px-3 py-1.5 text-sm text-fg"
          >
            Try Again
          </button>
        </div>
      ) : null}

      {!findQuery.isFetching && tenant ? (
        <div className="flex flex-col gap-5">
          <UpdateTenantForm
            initialName={tenant.name}
            pending={updateMutation.isPending}
            errorMessage={
              updateMutation.isError ? errorMessage(updateMutation.error, FALLBACK_ERROR) : null
            }
            onSubmit={(data) => updateMutation.mutate({ id: tenant.id, data })}
          />

          <div className="flex flex-col gap-1 text-sm">
            <span className="text-fg-muted">Slug</span>
            <span className="text-fg" data-testid="tenant-details-slug">
              {tenant.slug}
            </span>
          </div>

          <div className="flex flex-col gap-1 text-sm">
            <span className="text-fg-muted">Tenant ID</span>
            <div className="flex items-center gap-2">
              <span className="break-all font-mono text-xs text-fg" data-testid="tenant-details-id">
                {tenant.id}
              </span>
              <CopyTenantIdButton tenantId={tenant.id} />
            </div>
          </div>
        </div>
      ) : null}
    </Drawer>
  );
}
