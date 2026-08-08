'use client';

import { JsonForms } from '@jsonforms/react';
import { tokenCells, tokenRenderers } from '@poc-plattform-kit/forms';
import { useMemo, useRef, useState, type FormEvent } from 'react';
import { AlertIcon } from '@/components/icons';
import {
  createTenantJsonSchema,
  createTenantSchema,
  toCreateTenantPayload,
  type CreateTenantInput,
} from './schemas';
import { createTenantUiSchema } from './uischema';

export const CREATE_TENANT_FORM_ID = 'tenant-create-form';

type CreateTenantFormProps = {
  pending?: boolean;
  errorMessage?: string | null;
  onSubmit: (data: CreateTenantInput) => void;
};

/**
 * Create Tenant fields, hosted inside TenantCreateDrawer which owns the
 * footer's submit/cancel buttons via the HTML `form` attribute — this stays
 * a real <form> so Enter-to-submit keeps working for keyboard users.
 */
export function CreateTenantForm({
  pending = false,
  errorMessage = null,
  onSubmit,
}: CreateTenantFormProps) {
  const [data, setData] = useState<Record<string, unknown>>({ name: '', slug: '' });
  const dataRef = useRef(data);
  const [clientError, setClientError] = useState<string | null>(null);
  const schema = useMemo(() => createTenantJsonSchema, []);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = createTenantSchema.safeParse(toCreateTenantPayload(dataRef.current));
    if (!parsed.success) {
      setClientError(parsed.error.issues[0]?.message ?? 'Invalid form');
      return;
    }
    setClientError(null);
    onSubmit(parsed.data);
  }

  return (
    <form
      id={CREATE_TENANT_FORM_ID}
      className="flex flex-col gap-3"
      onSubmit={handleSubmit}
      data-testid="tenant-create-form"
    >
      <JsonForms
        schema={schema}
        uischema={createTenantUiSchema}
        data={data}
        renderers={tokenRenderers}
        cells={tokenCells}
        readonly={pending}
        validationMode="ValidateAndHide"
        onChange={({ data: next }) => {
          const record = { ...dataRef.current, ...(next as Record<string, unknown>) };
          dataRef.current = record;
          setData(record);
        }}
      />
      {clientError ? (
        <p
          className="flex items-center gap-2 text-sm text-fg"
          data-testid="tenant-create-client-error"
          role="alert"
        >
          <AlertIcon className="h-4 w-4 shrink-0" />
          {clientError}
        </p>
      ) : null}
      {errorMessage ? (
        <p
          className="flex items-center gap-2 text-sm text-fg"
          data-testid="tenant-create-error"
          role="alert"
        >
          <AlertIcon className="h-4 w-4 shrink-0" />
          {errorMessage}
        </p>
      ) : null}
    </form>
  );
}
