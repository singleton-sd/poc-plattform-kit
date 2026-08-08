'use client';

import type { TenantResponseDto } from '@poc-plattform-kit/api-client';
import { ChevronRightIcon } from '@/components/icons';

type TenantMobileListProps = {
  tenants: TenantResponseDto[];
  loading?: boolean;
  onSelect: (id: string) => void;
};

const SKELETON_ROWS = 5;

/** Mobile tenant list: compact rows with Name, Slug and a chevron, visible below sm. */
export function TenantMobileList({ tenants, loading = false, onSelect }: TenantMobileListProps) {
  if (loading) {
    return (
      <ul className="flex flex-col divide-y divide-fg-subtle/20 sm:hidden" aria-hidden="true">
        {Array.from({ length: SKELETON_ROWS }).map((_, index) => (
          <li key={index} className="flex flex-col gap-2 px-1 py-3">
            <div className="h-4 w-2/3 animate-pulse rounded bg-bg-muted" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-bg-muted" />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-fg-subtle/20 sm:hidden" aria-label="Tenants">
      {tenants.map((tenant) => (
        <li key={tenant.id}>
          <button
            type="button"
            onClick={() => onSelect(tenant.id)}
            className="flex w-full items-center justify-between gap-3 px-1 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
            data-testid="tenant-mobile-row"
          >
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium text-fg">{tenant.name}</span>
              <span className="truncate text-sm text-fg-muted">{tenant.slug}</span>
            </span>
            <ChevronRightIcon className="h-4 w-4 shrink-0 text-fg-muted" />
          </button>
        </li>
      ))}
    </ul>
  );
}
