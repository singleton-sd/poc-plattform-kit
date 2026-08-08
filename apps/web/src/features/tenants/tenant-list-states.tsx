'use client';

import { AlertIcon, PlusIcon } from '@/components/icons';

export function TenantEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div
      className="flex flex-col items-center gap-3 px-4 py-16 text-center"
      data-testid="tenant-empty-state"
    >
      <h2 className="font-heading text-lg font-semibold text-fg">Create your first tenant</h2>
      <p className="max-w-sm text-sm text-fg-muted">
        Tenants represent organisations using your platform.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="mt-2 inline-flex items-center gap-2 rounded bg-accent px-4 py-2 text-sm font-medium text-accent-on"
      >
        <PlusIcon className="h-4 w-4" />
        Create Tenant
      </button>
    </div>
  );
}

export function TenantSearchEmptyState({ onClearSearch }: { onClearSearch: () => void }) {
  return (
    <div
      className="flex flex-col items-center gap-3 px-4 py-16 text-center"
      data-testid="tenant-search-empty-state"
    >
      <p className="text-sm text-fg-muted">No tenants match your search.</p>
      <button
        type="button"
        onClick={onClearSearch}
        className="rounded border border-fg-subtle px-3 py-1.5 text-sm text-fg"
        data-testid="tenant-search-empty-clear"
      >
        Clear search
      </button>
    </div>
  );
}

export function TenantErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      className="flex flex-col items-center gap-3 px-4 py-16 text-center"
      data-testid="tenant-error-state"
      role="alert"
    >
      <AlertIcon className="h-6 w-6 text-fg" />
      <h2 className="font-heading text-lg font-semibold text-fg">Unable to load tenants</h2>
      <p className="max-w-sm text-sm text-fg-muted">We couldn&apos;t retrieve the tenant list.</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded border border-fg-subtle px-3 py-1.5 text-sm text-fg"
      >
        Try Again
      </button>
    </div>
  );
}
