'use client';

import {
  useTenantControllerFindOne,
  useTenantControllerUpdate,
} from '@poc-plattform-kit/api-client';
import { useEffect, useState, type FormEvent } from 'react';
import { AlertIcon } from '@/components/icons';
import { Toast } from '@/components/toast';
import { errorMessage, errorStatus, tenantPayload } from '@/features/tenants/api';
import { configureApiClient } from '@/lib/api-client';
import { parseSettingsText, tenantSettingsFormSchema } from './schemas';

/**
 * Tenant-admin settings: look up a tenant by id (dev/legacy `x-tenant-id`
 * escape — see docs/sso.md), then edit its name and settings.
 */
export function TenantSettings() {
  const [tenantIdInput, setTenantIdInput] = useState('');
  const [lookupId, setLookupId] = useState('');
  const [name, setName] = useState('');
  const [settingsText, setSettingsText] = useState('');
  const [clientError, setClientError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const findQuery = useTenantControllerFindOne(lookupId, {
    query: { enabled: lookupId.length > 0, retry: false },
  });
  const updateMutation = useTenantControllerUpdate({
    mutation: {
      onSuccess: (response) => {
        const updated = tenantPayload(response);
        if (updated) setToastMessage(`${updated.name} was updated.`);
      },
    },
  });

  const tenant = tenantPayload(findQuery.data);

  useEffect(() => {
    if (!tenant) return;
    setName(tenant.name);
    setSettingsText(tenant.settings ? JSON.stringify(tenant.settings, null, 2) : '');
  }, [tenant]);

  function handleLookup(event: FormEvent) {
    event.preventDefault();
    const id = tenantIdInput.trim();
    if (!id) return;
    configureApiClient({ tenantId: id });
    updateMutation.reset();
    setClientError(null);
    if (id === lookupId) {
      void findQuery.refetch();
      return;
    }
    setLookupId(id);
  }

  function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!tenant) return;

    const parsedName = tenantSettingsFormSchema.shape.name.safeParse(name);
    if (!parsedName.success) {
      setClientError(parsedName.error.issues[0]?.message ?? 'Invalid name');
      return;
    }

    const settingsResult = parseSettingsText(settingsText);
    if ('error' in settingsResult) {
      setClientError(settingsResult.error);
      return;
    }

    setClientError(null);
    updateMutation.mutate({
      id: tenant.id,
      data: { name: parsedName.data, ...settingsResult },
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 p-6" data-testid="tenant-settings">
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-semibold text-fg">Tenant settings</h1>
        <p className="text-sm text-fg-muted">Look up your tenant by id to view and edit it.</p>
      </header>

      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={handleLookup}
        data-testid="tenant-settings-lookup-form"
      >
        <label className="flex flex-1 flex-col gap-1 text-sm text-fg">
          Tenant id
          <input
            className="rounded border border-fg-subtle bg-bg px-3 py-2 text-fg"
            value={tenantIdInput}
            onChange={(event) => setTenantIdInput(event.target.value)}
            data-testid="tenant-settings-id-input"
          />
        </label>
        <button
          type="submit"
          className="rounded bg-accent px-4 py-2 text-sm font-medium text-accent-on disabled:opacity-50"
          disabled={!tenantIdInput.trim() || findQuery.isFetching}
          data-testid="tenant-settings-load"
        >
          {findQuery.isFetching ? 'Loading…' : 'Load tenant'}
        </button>
      </form>

      {findQuery.isFetching ? (
        <p className="text-sm text-fg-muted" role="status" data-testid="tenant-settings-loading">
          Loading tenant…
        </p>
      ) : null}

      {!findQuery.isFetching && findQuery.isError && errorStatus(findQuery.error) === 404 ? (
        <p className="text-sm text-fg" role="alert" data-testid="tenant-settings-not-found">
          No tenant was found with id {lookupId}.
        </p>
      ) : null}

      {!findQuery.isFetching && findQuery.isError && errorStatus(findQuery.error) !== 404 ? (
        <p className="text-sm text-fg" role="alert" data-testid="tenant-settings-load-error">
          Tenant lookup failed. Try again later.
        </p>
      ) : null}

      {tenant && !findQuery.isFetching ? (
        <form
          className="flex flex-col gap-4"
          onSubmit={handleSave}
          data-testid="tenant-settings-form"
        >
          <div className="flex flex-col gap-1 text-sm">
            <span className="text-fg-muted">Tenant ID</span>
            <span className="font-mono text-xs text-fg" data-testid="tenant-settings-id">
              {tenant.id}
            </span>
          </div>

          <div className="flex flex-col gap-1 text-sm">
            <span className="text-fg-muted">Slug</span>
            <span className="text-fg" data-testid="tenant-settings-slug">
              {tenant.slug}
            </span>
          </div>

          <label className="flex flex-col gap-1 text-sm text-fg">
            Name
            <input
              className="rounded border border-fg-subtle bg-bg px-3 py-2 text-fg"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={updateMutation.isPending}
              data-testid="tenant-settings-name"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-fg">
            Settings (JSON)
            <textarea
              className="min-h-32 rounded border border-fg-subtle bg-bg px-3 py-2 font-mono text-xs text-fg"
              value={settingsText}
              onChange={(event) => setSettingsText(event.target.value)}
              disabled={updateMutation.isPending}
              data-testid="tenant-settings-json"
            />
            <span className="text-xs text-fg-muted">
              Leave blank to keep the current settings unchanged.
            </span>
          </label>

          <button
            type="submit"
            className="self-start rounded bg-accent px-4 py-2 text-sm font-medium text-accent-on disabled:opacity-50"
            disabled={updateMutation.isPending}
            data-testid="tenant-settings-save"
          >
            {updateMutation.isPending ? 'Saving…' : 'Save changes'}
          </button>

          {clientError ? (
            <p
              className="flex items-center gap-2 text-sm text-fg"
              role="alert"
              data-testid="tenant-settings-client-error"
            >
              <AlertIcon className="h-4 w-4 shrink-0" />
              {clientError}
            </p>
          ) : null}

          {updateMutation.isError ? (
            <p
              className="flex items-center gap-2 text-sm text-fg"
              role="alert"
              data-testid="tenant-settings-save-error"
            >
              <AlertIcon className="h-4 w-4 shrink-0" />
              {errorMessage(updateMutation.error, 'Could not save changes. Try again.')}
            </p>
          ) : null}
        </form>
      ) : null}

      <Toast
        message={toastMessage}
        onDismiss={() => setToastMessage(null)}
        testId="tenant-settings-toast"
      />
    </div>
  );
}
