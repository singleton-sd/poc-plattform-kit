'use client';

import { JsonForms } from '@jsonforms/react';
import { tokenCells, tokenRenderers } from '@poc-plattform-kit/forms';
import { useMemo, useRef, useState, type FormEvent } from 'react';
import { createTenantJsonSchema, createTenantSchema, type CreateTenantInput } from './schemas';
import { createTenantUiSchema } from './uischema';

type CreateTenantFormProps = {
  pending?: boolean;
  error?: boolean;
  onSubmit: (data: CreateTenantInput) => void;
};

export function CreateTenantForm({
  pending = false,
  error = false,
  onSubmit,
}: CreateTenantFormProps) {
  const [data, setData] = useState<Record<string, unknown>>({ name: '', slug: '' });
  const dataRef = useRef(data);
  const [clientError, setClientError] = useState<string | null>(null);
  const schema = useMemo(() => createTenantJsonSchema, []);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = createTenantSchema.safeParse(dataRef.current);
    if (!parsed.success) {
      setClientError(parsed.error.issues[0]?.message ?? 'Invalid form');
      return;
    }
    setClientError(null);
    onSubmit(parsed.data);
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={handleSubmit} data-testid="tenant-create-form">
      <JsonForms
        schema={schema}
        uischema={createTenantUiSchema}
        data={data}
        renderers={tokenRenderers}
        cells={tokenCells}
        validationMode="ValidateAndHide"
        onChange={({ data: next }) => {
          const record = { ...dataRef.current, ...(next as Record<string, unknown>) };
          dataRef.current = record;
          setData(record);
        }}
      />
      <button
        type="submit"
        className="rounded bg-accent px-3 py-2 text-sm font-medium text-accent-on disabled:opacity-50"
        disabled={pending}
        data-testid="tenant-create"
      >
        {pending ? 'Creating…' : 'Create tenant'}
      </button>
      {clientError ? (
        <p className="text-sm text-fg" data-testid="tenant-create-client-error">
          {clientError}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-fg" data-testid="tenant-create-error">
          Create failed.
        </p>
      ) : null}
    </form>
  );
}
