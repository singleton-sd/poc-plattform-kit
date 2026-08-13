'use client';

import { useTenantControllerFindOne, type TenantResponseDto } from '@poc-plattform-kit/api-client';
import { useState, type FormEvent } from 'react';
import { configureApiClient } from '@/lib/api-client';

function tenantPayload(response: unknown): TenantResponseDto | null {
  if (!response || typeof response !== 'object') return null;
  const data = (response as { data?: unknown }).data;
  if (!data || typeof data !== 'object') return null;
  const tenant = data as Partial<TenantResponseDto>;
  if (
    typeof tenant.id !== 'string' ||
    typeof tenant.name !== 'string' ||
    typeof tenant.slug !== 'string'
  ) {
    return null;
  }
  return tenant as TenantResponseDto;
}

function errorStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object' || !('status' in error)) return null;
  return typeof error.status === 'number' ? error.status : null;
}

export function TenantLookup() {
  const [tenantId, setTenantId] = useState('');
  const [lookupId, setLookupId] = useState('');
  const query = useTenantControllerFindOne(lookupId, {
    query: { enabled: lookupId.length > 0, retry: false },
  });
  const tenant = tenantPayload(query.data);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = tenantId.trim();
    if (!id) return;
    configureApiClient({ tenantId: id });
    if (id === lookupId) {
      void query.refetch();
      return;
    }
    setLookupId(id);
  }

  return (
    <section className="mt-8 max-w-xl rounded border border-fg-subtle bg-bg-muted p-5">
      <h2 className="font-heading text-lg font-medium text-fg">Tenant lookup</h2>
      <p className="mt-1 text-sm text-fg-muted">Enter a tenant id to open its support context.</p>

      <form className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={onSubmit}>
        <label className="flex flex-1 flex-col gap-1 text-sm text-fg">
          Tenant id
          <input
            className="rounded border border-fg-subtle bg-bg px-3 py-2 text-fg"
            value={tenantId}
            onChange={(event) => setTenantId(event.target.value)}
            required
            aria-required="true"
          />
        </label>
        <button
          type="submit"
          className="rounded bg-accent px-4 py-2 text-sm font-medium text-bg disabled:opacity-50"
          disabled={!tenantId.trim() || query.isFetching}
        >
          {query.isFetching ? 'Looking up…' : 'Look up tenant'}
        </button>
      </form>

      {query.isFetching ? (
        <p className="mt-4 text-sm text-fg-muted" role="status">
          Loading tenant…
        </p>
      ) : null}

      {query.isError && errorStatus(query.error) === 404 ? (
        <p className="mt-4 text-sm text-fg" role="alert">
          No tenant was found with id {lookupId}.
        </p>
      ) : null}

      {query.isError && errorStatus(query.error) !== 404 ? (
        <p className="mt-4 text-sm text-fg" role="alert">
          Tenant lookup failed. Try again later.
        </p>
      ) : null}

      {tenant && !query.isFetching ? (
        <div
          className="mt-4 rounded border border-fg-subtle bg-bg p-4 text-sm text-fg"
          data-testid="support-tenant-result"
        >
          <h3 className="font-heading text-base font-medium">{tenant.name}</h3>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="text-fg-muted">Id</dt>
            <dd>{tenant.id}</dd>
            <dt className="text-fg-muted">Slug</dt>
            <dd>{tenant.slug}</dd>
          </dl>
        </div>
      ) : null}
    </section>
  );
}
