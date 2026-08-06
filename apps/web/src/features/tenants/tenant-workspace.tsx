'use client';

import {
  useTenantControllerCreate,
  useTenantControllerFindOne,
  useTenantControllerUpdate,
  type TenantResponseDto,
} from '@poc-plattform-kit/api-client';
import { useEffect, useState, type FormEvent } from 'react';
import { configureApiClient } from '@/lib/api-client';

function tenantPayload(
  response: { data: TenantResponseDto } | undefined,
): TenantResponseDto | null {
  return response?.data ?? null;
}

export function TenantWorkspace() {
  const [tenantId, setTenantId] = useState('');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [lookupId, setLookupId] = useState('');

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
  const display = updated ?? created ?? loaded;

  useEffect(() => {
    if (!created) return;
    setTenantId(created.id);
    setName(created.name);
    setSlug(created.slug);
    setLookupId(created.id);
  }, [created]);

  useEffect(() => {
    if (!loaded) return;
    setName(loaded.name);
    setSlug(loaded.slug);
  }, [loaded]);

  function onCreate(event: FormEvent) {
    event.preventDefault();
    createMutation.mutate({ data: { name: name.trim(), slug: slug.trim() } });
  }

  function onLoad(event: FormEvent) {
    event.preventDefault();
    const id = tenantId.trim();
    if (!id) return;
    setLookupId(id);
  }

  function onUpdate() {
    const id = (display?.id ?? tenantId).trim();
    if (!id || !name.trim()) return;
    configureApiClient({ tenantId: id });
    updateMutation.mutate({ id, data: { name: name.trim() } });
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-8 p-6" data-testid="tenant-workspace">
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-semibold text-fg">Tenants</h1>
        <p className="text-sm text-fg-muted">
          Reads and writes go through the generated <code>@poc-plattform-kit/api-client</code>{' '}
          hooks. Set tenant id to send <code>x-tenant-id</code> on get/update.
        </p>
      </header>

      <form className="flex flex-col gap-3" onSubmit={onCreate} data-testid="tenant-create-form">
        <h2 className="font-heading text-lg font-medium text-fg">Create</h2>
        <label className="flex flex-col gap-1 text-sm text-fg">
          Name
          <input
            className="rounded border border-fg-subtle bg-bg px-3 py-2 text-fg"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            data-testid="tenant-name"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-fg">
          Slug
          <input
            className="rounded border border-fg-subtle bg-bg px-3 py-2 text-fg"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            required
            data-testid="tenant-slug"
          />
        </label>
        <button
          type="submit"
          className="rounded bg-accent px-3 py-2 text-sm font-medium text-accent-on disabled:opacity-50"
          disabled={createMutation.isPending}
          data-testid="tenant-create"
        >
          {createMutation.isPending ? 'Creating…' : 'Create tenant'}
        </button>
        {createMutation.isError ? (
          <p className="text-sm text-fg" data-testid="tenant-create-error">
            Create failed.
          </p>
        ) : null}
      </form>

      <form className="flex flex-col gap-3" onSubmit={onLoad} data-testid="tenant-load-form">
        <h2 className="font-heading text-lg font-medium text-fg">Load / update</h2>
        <label className="flex flex-col gap-1 text-sm text-fg">
          Tenant id
          <input
            className="rounded border border-fg-subtle bg-bg px-3 py-2 text-fg"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            data-testid="tenant-id"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            className="rounded border border-fg-subtle px-3 py-2 text-sm text-fg disabled:opacity-50"
            disabled={!tenantId.trim() || findQuery.isFetching}
            data-testid="tenant-load"
          >
            {findQuery.isFetching ? 'Loading…' : 'Load tenant'}
          </button>
          <button
            type="button"
            className="rounded bg-accent px-3 py-2 text-sm font-medium text-accent-on disabled:opacity-50"
            disabled={!tenantId.trim() || !name.trim() || updateMutation.isPending}
            onClick={onUpdate}
            data-testid="tenant-update"
          >
            {updateMutation.isPending ? 'Updating…' : 'Update name'}
          </button>
        </div>
        {findQuery.isError ? (
          <p className="text-sm text-fg" data-testid="tenant-load-error">
            Load failed.
          </p>
        ) : null}
        {updateMutation.isError ? (
          <p className="text-sm text-fg" data-testid="tenant-update-error">
            Update failed.
          </p>
        ) : null}
      </form>

      {display ? (
        <section
          className="rounded border border-fg-subtle bg-bg-muted p-4 text-sm text-fg"
          data-testid="tenant-result"
        >
          <h2 className="font-heading mb-2 text-lg font-medium">Current tenant</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="text-fg-muted">Id</dt>
            <dd data-testid="tenant-result-id">{display.id}</dd>
            <dt className="text-fg-muted">Name</dt>
            <dd data-testid="tenant-result-name">{display.name}</dd>
            <dt className="text-fg-muted">Slug</dt>
            <dd data-testid="tenant-result-slug">{display.slug}</dd>
          </dl>
        </section>
      ) : null}
    </div>
  );
}
