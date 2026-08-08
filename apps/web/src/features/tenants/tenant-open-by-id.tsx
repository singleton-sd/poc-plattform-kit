'use client';

import { useState, type FormEvent } from 'react';

type TenantOpenByIdProps = {
  onOpen: (tenantId: string) => void;
};

/**
 * Fallback entry point that opens Tenant Details directly by id, bypassing
 * GET /tenants (support-agent only). Preserves access for tenant-admin-only
 * users who know their own tenant's id but cannot browse the full list —
 * GET /tenants/:id and PATCH /tenants/:id do not require support-agent.
 */
export function TenantOpenById({ onOpen }: TenantOpenByIdProps) {
  const [expanded, setExpanded] = useState(false);
  const [tenantId, setTenantId] = useState('');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const id = tenantId.trim();
    if (!id) return;
    onOpen(id);
    setTenantId('');
    setExpanded(false);
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="shrink-0 whitespace-nowrap text-sm text-fg-muted underline-offset-2 hover:text-fg hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        data-testid="tenant-open-by-id-toggle"
      >
        Open by tenant ID
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex shrink-0 items-center gap-2"
      data-testid="tenant-open-by-id-form"
    >
      <label className="sr-only" htmlFor="tenant-open-by-id-input">
        Tenant ID
      </label>
      <input
        id="tenant-open-by-id-input"
        autoFocus
        value={tenantId}
        onChange={(event) => setTenantId(event.target.value)}
        placeholder="Tenant ID"
        className="w-40 rounded border border-fg-subtle bg-bg px-2 py-1.5 text-sm text-fg placeholder:text-fg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      />
      <button
        type="submit"
        disabled={!tenantId.trim()}
        className="rounded border border-fg-subtle px-2 py-1.5 text-sm text-fg disabled:opacity-50"
      >
        Open
      </button>
      <button
        type="button"
        onClick={() => {
          setExpanded(false);
          setTenantId('');
        }}
        aria-label="Cancel open by tenant ID"
        className="text-sm text-fg-muted hover:text-fg"
      >
        Cancel
      </button>
    </form>
  );
}
