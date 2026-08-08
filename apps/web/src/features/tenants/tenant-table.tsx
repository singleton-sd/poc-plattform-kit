'use client';

import type { TenantResponseDto } from '@poc-plattform-kit/api-client';
import { CopyTenantIdButton } from './copy-tenant-id-button';

type TenantTableProps = {
  tenants: TenantResponseDto[];
  loading?: boolean;
  onSelect: (id: string) => void;
};

const SKELETON_ROWS = 5;

/** Desktop tenant list: compact table, hidden below the sm breakpoint. */
export function TenantTable({ tenants, loading = false, onSelect }: TenantTableProps) {
  return (
    <table
      className="hidden w-full border-collapse text-left text-sm sm:table"
      aria-label="Tenants"
    >
      <thead>
        <tr className="border-b border-fg-subtle/30 text-xs uppercase tracking-wide text-fg-muted">
          <th scope="col" className="px-4 py-2 font-medium">
            Name
          </th>
          <th scope="col" className="px-4 py-2 font-medium">
            Slug
          </th>
          <th scope="col" className="px-4 py-2 font-medium">
            Tenant ID
          </th>
          <th scope="col" className="px-4 py-2 font-medium">
            <span className="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {loading
          ? Array.from({ length: SKELETON_ROWS }).map((_, index) => (
              <tr key={index} className="border-b border-fg-subtle/20" aria-hidden="true">
                <td className="px-4 py-3">
                  <div className="h-4 w-32 animate-pulse rounded bg-bg-muted" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-4 w-24 animate-pulse rounded bg-bg-muted" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-4 w-40 animate-pulse rounded bg-bg-muted" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-4 w-16 animate-pulse rounded bg-bg-muted" />
                </td>
              </tr>
            ))
          : tenants.map((tenant) => (
              <tr
                key={tenant.id}
                className="group relative border-b border-fg-subtle/20 hover:bg-bg-muted"
                data-testid="tenant-row"
              >
                <td className="px-4 py-3 font-medium text-fg">
                  {/* Contained by the (relatively positioned) tr, so it spans the whole row —
                      the whole row is selectable while the Actions cell below stays on top. */}
                  <button
                    type="button"
                    onClick={() => onSelect(tenant.id)}
                    aria-label={`View details for ${tenant.name}`}
                    className="absolute inset-0 text-left focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
                    data-testid="tenant-row-select"
                  />
                  {tenant.name}
                </td>
                <td className="px-4 py-3 text-fg-muted">{tenant.slug}</td>
                <td className="px-4 py-3 font-mono text-xs text-fg-muted">{tenant.id}</td>
                <td className="px-4 py-3 text-right">
                  <span className="relative z-10 inline-block">
                    <CopyTenantIdButton tenantId={tenant.id} />
                  </span>
                </td>
              </tr>
            ))}
      </tbody>
    </table>
  );
}
