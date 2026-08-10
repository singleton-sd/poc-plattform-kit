'use client';

import { useState } from 'react';
import type { CreateAccessRequestDto } from '@poc-plattform-kit/api-client';
import { useRequestAccess } from './use-permission';

type RequestAccessDialogProps = {
  open: boolean;
  action: string;
  resource: string;
  tenantId?: string | null;
  onClose: () => void;
  onSubmitted?: () => void;
};

const GRANT_TYPES = [
  { value: 'permanent', label: 'Permanent' },
  { value: 'temporary', label: 'Temporary' },
  { value: 'one_time', label: 'One-time' },
] as const;

export function RequestAccessDialog({
  open,
  action,
  resource,
  tenantId,
  onClose,
  onSubmitted,
}: RequestAccessDialogProps) {
  const request = useRequestAccess();
  const [grantType, setGrantType] = useState<(typeof GRANT_TYPES)[number]['value']>('permanent');
  const [expiresAt, setExpiresAt] = useState('');

  if (!open) return null;

  const submit = () => {
    const body: CreateAccessRequestDto = {
      action,
      resource,
      ...(tenantId ? { tenantId } : {}),
      preferredGrantType: grantType,
      ...(grantType === 'temporary' && expiresAt
        ? { preferredGrantExpiresAt: new Date(expiresAt).toISOString() }
        : {}),
    };
    request.mutate(body, {
      onSuccess: () => {
        onSubmitted?.();
        onClose();
      },
    });
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-fg/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="request-access-title"
      data-testid="request-access-dialog"
    >
      <div className="w-full max-w-md rounded bg-bg p-5 shadow-lg">
        <h2 id="request-access-title" className="font-heading text-lg text-fg">
          Request access
        </h2>
        <p className="mt-2 text-sm text-fg-muted">
          Ask your admin or manager for permission to <span className="text-fg">{action}</span> on{' '}
          <span className="text-fg">{resource}</span>.
        </p>

        <fieldset className="mt-4 flex flex-col gap-2">
          <legend className="text-sm text-fg">Preferred grant type</legend>
          {GRANT_TYPES.map((option) => (
            <label key={option.value} className="flex items-center gap-2 text-sm text-fg">
              <input
                type="radio"
                name="preferredGrantType"
                value={option.value}
                checked={grantType === option.value}
                onChange={() => setGrantType(option.value)}
              />
              {option.label}
            </label>
          ))}
        </fieldset>

        {grantType === 'temporary' ? (
          <label className="mt-3 flex flex-col gap-1 text-sm text-fg">
            Preferred expiry
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
              className="rounded border border-fg-subtle bg-bg px-2 py-1.5 text-fg"
              data-testid="request-access-expires"
            />
          </label>
        ) : null}

        {request.isError ? (
          <p className="mt-3 text-sm text-fg" role="alert">
            Could not submit the request. Try again.
          </p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-fg-subtle px-3 py-2 text-sm text-fg"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={request.isPending || (grantType === 'temporary' && !expiresAt)}
            className="rounded bg-accent px-3 py-2 text-sm font-medium text-accent-on disabled:opacity-50"
            data-testid="request-access-submit"
          >
            {request.isPending ? 'Submitting…' : 'Submit request'}
          </button>
        </div>
      </div>
    </div>
  );
}
