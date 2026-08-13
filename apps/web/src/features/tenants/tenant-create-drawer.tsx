'use client';

import { useTenantControllerCreate, type TenantResponseDto } from '@poc-plattform-kit/api-client';
import { useEffect, useState } from 'react';
import { Drawer } from '@/components/drawer';
import { errorMessage, tenantPayload } from './api';
import { CREATE_TENANT_FORM_ID, CreateTenantForm } from './create-tenant-form';

type TenantCreateDrawerProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (tenant: TenantResponseDto) => void;
};

const FALLBACK_ERROR = 'Could not create the tenant. Try again.';

export function TenantCreateDrawer({ open, onClose, onCreated }: TenantCreateDrawerProps) {
  const [formValid, setFormValid] = useState(false);
  const mutation = useTenantControllerCreate({
    mutation: {
      onSuccess: (response) => {
        const tenant = tenantPayload(response);
        if (tenant) onCreated(tenant);
      },
    },
  });

  const { reset } = mutation;
  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  function handleClose() {
    onClose();
  }

  return (
    <Drawer
      open={open}
      title="Create tenant"
      onClose={handleClose}
      testId="tenant-create-drawer"
      footer={
        <>
          <button
            type="submit"
            form={CREATE_TENANT_FORM_ID}
            disabled={mutation.isPending || !formValid}
            className="rounded bg-accent px-3 py-2 text-sm font-medium text-accent-on disabled:opacity-50"
            data-testid="tenant-create-submit"
          >
            {mutation.isPending ? 'Creating…' : 'Create Tenant'}
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="rounded border border-fg-subtle px-3 py-2 text-sm text-fg"
          >
            Cancel
          </button>
        </>
      }
    >
      <p className="mb-4 text-sm text-fg-muted">
        Tenants represent organisations using your platform.
      </p>
      <CreateTenantForm
        pending={mutation.isPending}
        errorMessage={mutation.isError ? errorMessage(mutation.error, FALLBACK_ERROR) : null}
        onValidityChange={setFormValid}
        onSubmit={(data) => mutation.mutate({ data })}
      />
    </Drawer>
  );
}
