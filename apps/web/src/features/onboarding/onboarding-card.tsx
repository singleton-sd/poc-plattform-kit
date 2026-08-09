'use client';

import { useTenantControllerCreate, type TenantResponseDto } from '@poc-plattform-kit/api-client';
import { useState } from 'react';
import { PlusIcon } from '@/components/icons';
import { errorMessage, tenantPayload } from '@/features/tenants/api';
import { CREATE_TENANT_FORM_ID, CreateTenantForm } from '@/features/tenants/create-tenant-form';

const FALLBACK_ERROR = 'Could not create the tenant. Try again.';

type OnboardingCardProps = {
  onCreated: (tenant: TenantResponseDto) => void;
  onDismiss: () => void;
};

/**
 * Self-service "create your tenant" entry point for a signed-in user who
 * isn't a member of any tenant yet. Reuses the same `CreateTenantForm` /
 * validation schema as the admin-facing `TenantCreateDrawer`
 * (`apps/web/src/features/tenants`) and the same generated
 * `POST /tenants` hook, which already auto-assigns the caller as owner.
 */
export function OnboardingCard({ onCreated, onDismiss }: OnboardingCardProps) {
  const [open, setOpen] = useState(false);
  const mutation = useTenantControllerCreate({
    mutation: {
      onSuccess: (response) => {
        const tenant = tenantPayload(response);
        if (tenant) onCreated(tenant);
      },
    },
  });

  return (
    <section
      className="mt-6 w-full rounded border border-fg-subtle bg-bg-muted p-5 text-left"
      data-testid="onboarding-card"
    >
      <h2 className="font-heading text-lg font-medium text-fg">
        {open ? 'Create your tenant' : "You're not part of a tenant yet"}
      </h2>
      <p className="mt-1 text-sm text-fg-muted">
        {open
          ? 'Name your tenant to get started. You automatically become its owner.'
          : 'Create your own tenant and become its owner — no admin needed.'}
      </p>

      {open ? (
        <div className="mt-4 flex flex-col gap-3">
          <CreateTenantForm
            pending={mutation.isPending}
            errorMessage={mutation.isError ? errorMessage(mutation.error, FALLBACK_ERROR) : null}
            onSubmit={(data) => mutation.mutate({ data })}
          />
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              form={CREATE_TENANT_FORM_ID}
              disabled={mutation.isPending}
              className="rounded bg-accent px-4 py-2 text-sm font-medium text-accent-on disabled:opacity-50"
              data-testid="onboarding-create-submit"
            >
              {mutation.isPending ? 'Creating…' : 'Create Tenant'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={mutation.isPending}
              className="rounded border border-fg-subtle px-4 py-2 text-sm text-fg disabled:opacity-50"
              data-testid="onboarding-create-cancel"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 rounded bg-accent px-4 py-2 text-sm font-medium text-accent-on"
            data-testid="onboarding-create-open"
          >
            <PlusIcon className="h-4 w-4" />
            Create your tenant
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded px-4 py-2 text-sm text-fg-muted underline-offset-2 hover:text-accent hover:underline"
            data-testid="onboarding-dismiss"
          >
            Not now
          </button>
        </div>
      )}
    </section>
  );
}
