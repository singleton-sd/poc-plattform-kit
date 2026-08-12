'use client';

import {
  useTenantControllerFindOne,
  useTenantControllerUpdate,
} from '@poc-plattform-kit/api-client';
import { useEffect, useState, type FormEvent } from 'react';
import { AlertIcon } from '@/components/icons';
import { Toast } from '@/components/toast';
import { errorMessage, errorStatus, tenantPayload } from '@/features/tenants/api';
import { UPDATE_TENANT_FORM_ID, UpdateTenantForm } from '@/features/tenants/update-tenant-form';
import type { UpdateTenantInput } from '@/features/tenants/schemas';
import { configureApiClient } from '@/lib/api-client';
import { parseSettingsText } from './schemas';

export type TenantSettingsProps = {
  /**
   * Pre-fills the lookup form and triggers the initial lookup, e.g. when
   * arriving via the onboarding card's "Manage your tenant" link
   * (`?tenantId=...`) right after self-service creation, so the new owner
   * doesn't have to copy/paste the id they were just shown.
   */
  initialTenantId?: string;
};

/**
 * Tenant-admin settings: look up a tenant by id (dev/legacy `x-tenant-id`
 * escape — see docs/sso.md), then edit its name and settings. Name is
 * edited through the shared `UpdateTenantForm` (schema-driven-forms
 * pipeline); settings is an arbitrary JSON object, handled as a hand-built
 * escape hatch — see the comment on `parseSettingsText`.
 */
export function TenantSettings({ initialTenantId }: TenantSettingsProps = {}) {
  const [tenantIdInput, setTenantIdInput] = useState(initialTenantId ?? '');
  const [lookupId, setLookupId] = useState('');
  const [settingsText, setSettingsText] = useState('');
  const [clientError, setClientError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!initialTenantId) return;
    configureApiClient({ tenantId: initialTenantId });
    setLookupId(initialTenantId);
    // Only ever meant to prefill the lookup once, from the id the page was opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  function handleNameSubmit(data: UpdateTenantInput) {
    if (!tenant) return;

    const settingsResult = parseSettingsText(settingsText);
    if ('error' in settingsResult) {
      setClientError(settingsResult.error);
      return;
    }

    setClientError(null);
    updateMutation.mutate({
      id: tenant.id,
      data: { ...data, ...settingsResult },
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

      {tenant && !findQuery.isFetching && !findQuery.isError ? (
        <div className="flex flex-col gap-5" data-testid="tenant-settings-form">
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

          <UpdateTenantForm
            initialName={tenant.name}
            pending={updateMutation.isPending}
            errorMessage={
              updateMutation.isError
                ? errorMessage(updateMutation.error, 'Could not save changes. Try again.')
                : null
            }
            onSubmit={handleNameSubmit}
          />

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
            form={UPDATE_TENANT_FORM_ID}
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
        </div>
      ) : null}

      <Toast
        message={toastMessage}
        onDismiss={() => setToastMessage(null)}
        testId="tenant-settings-toast"
      />
    </div>
  );
}
