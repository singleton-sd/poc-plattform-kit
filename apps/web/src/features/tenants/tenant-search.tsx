'use client';

import { CloseIcon, SearchIcon } from '@/components/icons';

type TenantSearchProps = {
  value: string;
  onChange: (value: string) => void;
};

/** Filters the tenant list by name or slug. */
export function TenantSearch({ value, onChange }: TenantSearchProps) {
  return (
    <div className="relative flex-1 sm:max-w-xs">
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search by name or slug"
        aria-label="Search tenants"
        data-testid="tenant-search"
        className="w-full rounded border border-fg-subtle bg-bg py-2 pl-9 pr-9 text-sm text-fg placeholder:text-fg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          data-testid="tenant-search-clear"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-fg-muted hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          <CloseIcon className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}
