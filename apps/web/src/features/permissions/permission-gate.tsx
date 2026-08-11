'use client';

import { useState, type ReactNode } from 'react';
import { Tooltip } from '@/components/tooltip';
import { RequestAccessDialog } from './request-access-dialog';
import { usePermission } from './use-permission';

type PermissionGateProps = {
  action: string;
  resource: string;
  tenantId?: string | null;
  /** Primary control when allowed (e.g. Save button). */
  children: ReactNode;
  /** Optional disabled substitute when denied (defaults to disabled clone styling via slot). */
  deniedControl?: ReactNode;
};

const TOOLTIP = 'Request your admin/manager to perform this action';

export function PermissionGate({
  action,
  resource,
  tenantId,
  children,
  deniedControl,
}: PermissionGateProps) {
  const permission = usePermission({ action, resource });
  const [dialogOpen, setDialogOpen] = useState(false);

  if (permission.isLoading) {
    return (
      <button
        type="button"
        disabled
        className="rounded bg-accent px-3 py-2 text-sm font-medium text-accent-on opacity-50"
        data-testid="permission-gate-loading"
      >
        Checking access…
      </button>
    );
  }

  if (permission.isError) {
    return (
      <div className="flex flex-wrap items-center gap-2" data-testid="permission-gate-error">
        <p className="text-sm text-fg" role="alert">
          {permission.errorMessage}
        </p>
        <button
          type="button"
          onClick={() => void permission.refetch()}
          className="rounded border border-fg-subtle px-3 py-2 text-sm text-fg"
          data-testid="permission-gate-retry"
        >
          Retry
        </button>
      </div>
    );
  }

  if (permission.allowed) {
    return <>{children}</>;
  }

  const statusLabel = permission.pendingRequest
    ? `Access request ${permission.pendingRequest.status}`
    : permission.latestRequest
      ? `Last request: ${permission.latestRequest.status}`
      : null;

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="permission-gate-denied">
      <Tooltip content={TOOLTIP}>
        <span className="inline-flex">
          {deniedControl ?? (
            <button
              type="button"
              className="rounded bg-accent px-3 py-2 text-sm font-medium text-accent-on opacity-50"
              data-testid="permission-gate-disabled"
              aria-disabled="true"
              title={TOOLTIP}
              onClick={(event) => event.preventDefault()}
            >
              Save Changes
            </button>
          )}
        </span>
      </Tooltip>

      {permission.pendingRequest ? (
        <span className="text-sm text-fg-muted" data-testid="permission-gate-status">
          Request {permission.pendingRequest.status}
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="rounded border border-fg-subtle px-3 py-2 text-sm text-fg"
          data-testid="permission-gate-request-cta"
        >
          Request access
        </button>
      )}

      {statusLabel && !permission.pendingRequest ? (
        <span className="text-sm text-fg-muted" data-testid="permission-gate-status">
          {statusLabel}
        </span>
      ) : null}

      <RequestAccessDialog
        open={dialogOpen}
        action={action}
        resource={resource}
        tenantId={tenantId}
        onClose={() => setDialogOpen(false)}
        onSubmitted={() => void permission.refetch()}
      />
    </div>
  );
}
