'use client';

import {
  useTenantControllerCreate,
  useTenantControllerFindOne,
  useTenantControllerUpdate,
  type TenantResponseDto,
} from '@poc-plattform-kit/api-client';
import { useEffect, useState, type FormEvent } from 'react';
import { configureApiClient } from '@/lib/api-client';
import { CreateTenantForm } from './create-tenant-form';
import { UpdateTenantForm } from './update-tenant-form';
import type { CreateTenantInput, UpdateTenantInput } from './schemas';

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

export function TenantWorkspace() {
  const [tenantId, setTenantId] = useState('');
  const [lookupId, setLookupId] = useState('');
  const [activeTenant, setActiveTenant] = useState<TenantResponseDto | null>(null);

  useEffect(() => {
    configureApiClient({ tenantId: tenantId || null });
  }, [tenantId]);

  const createMutation = useTenantControllerCreate();
  const updateMutation = useTenantControllerUpdate();
  const findQuery = useTenantControllerFindOne(lookupId, {
    query: { enabled: lookupId.length > 0, retry: false },
  });

  const loaded = tenantPayload(findQuery.data);
  const created = tenantPayload(createMutation.data);
  const updated = tenantPayload(updateMutation.data);

  useEffect(() => {
    if (!created) return;
    setActiveTenant(created);
    setTenantId(created.id);
    setLookupId(created.id);
  }, [created]);

  useEffect(() => {
    if (!updated) return;
    setActiveTenant(updated);
  }, [updated]);

  useEffect(() => {
    if (!loaded) return;
    setActiveTenant(loaded);
  }, [loaded]);

  function onCreate(data: CreateTenantInput) {
    createMutation.mutate({ data });
  }

  function onLoad(event: FormEvent) {
    event.preventDefault();
    const id = tenantId.trim();
    if (!id) return;
    createMutation.reset();
    updateMutation.reset();
    if (id === lookupId) {
      void findQuery.refetch();
      return;
    }
    setLookupId(id);
  }

  function onUpdate(data: UpdateTenantInput) {
    const id = (activeTenant?.id ?? tenantId).trim();
    if (!id) return;
    configureApiClient({ tenantId: id });
    updateMutation.mutate({ id, data });
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-8 p-6" data-testid="tenant-workspace">
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-semibold text-fg">Tenants</h1>
        <p className="text-sm text-fg-muted">
          Reads and writes go through the generated <code>@poc-plattform-kit/api-client</code>{' '}
          hooks. Create/update fields use Zod → JSON Forms. Set tenant id to send{' '}
          <code>x-tenant-id</code> on get/update.
        </p>
      </header>

      <CreateTenantForm
        pending={createMutation.isPending}
        error={createMutation.isError}
        onSubmit={onCreate}
      />

      <form className="flex flex-col gap-3" onSubmit={onLoad} data-testid="tenant-load-form">
        <h2 className="font-heading text-lg font-medium text-fg">Load</h2>
        <label className="flex flex-col gap-1 text-sm text-fg">
          Tenant id
          <input
            className="rounded border border-fg-subtle bg-bg px-3 py-2 text-fg"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            data-testid="tenant-id"
          />
        </label>
        <button
          type="submit"
          className="rounded border border-fg-subtle px-3 py-2 text-sm text-fg disabled:opacity-50"
          disabled={!tenantId.trim() || findQuery.isFetching}
          data-testid="tenant-load"
        >
          {findQuery.isFetching ? 'Loading…' : 'Load tenant'}
        </button>
        {findQuery.isError ? (
          <p className="text-sm text-fg" data-testid="tenant-load-error">
            Load failed.
          </p>
        ) : null}
      </form>

      <UpdateTenantForm
        initialName={activeTenant?.name ?? ''}
        pending={updateMutation.isPending}
        error={updateMutation.isError}
        disabled={!tenantId.trim() && !activeTenant?.id}
        onSubmit={onUpdate}
      />

      {activeTenant ? (
        <section
          className="rounded border border-fg-subtle bg-bg-muted p-4 text-sm text-fg"
          data-testid="tenant-result"
        >
          <h2 className="font-heading mb-2 text-lg font-medium">Current tenant</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="text-fg-muted">Id</dt>
            <dd data-testid="tenant-result-id">{activeTenant.id}</dd>
            <dt className="text-fg-muted">Name</dt>
            <dd data-testid="tenant-result-name">{activeTenant.name}</dd>
            <dt className="text-fg-muted">Slug</dt>
            <dd data-testid="tenant-result-slug">{activeTenant.slug}</dd>
          </dl>
        </section>
      ) : null}
    </div>
  );
}
