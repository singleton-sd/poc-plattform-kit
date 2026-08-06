'use client';

import { JsonForms } from '@jsonforms/react';
import { tokenCells, tokenRenderers } from '@poc-plattform-kit/forms';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { updateTenantJsonSchema, updateTenantSchema, type UpdateTenantInput } from './schemas';
import { updateTenantUiSchema } from './uischema';

type UpdateTenantFormProps = {
  initialName?: string;
  pending?: boolean;
  error?: boolean;
  disabled?: boolean;
  onSubmit: (data: UpdateTenantInput) => void;
};

export function UpdateTenantForm({
  initialName = '',
  pending = false,
  error = false,
  disabled = false,
  onSubmit,
}: UpdateTenantFormProps) {
  const [data, setData] = useState<Record<string, unknown>>({ name: initialName });
  const dataRef = useRef(data);
  const [clientError, setClientError] = useState<string | null>(null);
  const schema = useMemo(() => updateTenantJsonSchema, []);

  useEffect(() => {
    const next = { name: initialName };
    dataRef.current = next;
    setData(next);
  }, [initialName]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = updateTenantSchema.safeParse(dataRef.current);
    if (!parsed.success) {
      setClientError(parsed.error.issues[0]?.message ?? 'Invalid form');
      return;
    }
    setClientError(null);
    onSubmit(parsed.data);
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={handleSubmit} data-testid="tenant-update-form">
      <JsonForms
        schema={schema}
        uischema={updateTenantUiSchema}
        data={data}
        renderers={tokenRenderers}
        cells={tokenCells}
        readonly={disabled}
        validationMode="ValidateAndHide"
        onChange={({ data: next }) => {
          const record = next as Record<string, unknown>;
          dataRef.current = record;
          setData(record);
        }}
      />
      <button
        type="submit"
        className="rounded bg-accent px-3 py-2 text-sm font-medium text-accent-on disabled:opacity-50"
        disabled={disabled || pending}
        data-testid="tenant-update"
      >
        {pending ? 'Updating…' : 'Update name'}
      </button>
      {clientError ? (
        <p className="text-sm text-fg" data-testid="tenant-update-client-error">
          {clientError}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-fg" data-testid="tenant-update-error">
          Update failed.
        </p>
      ) : null}
    </form>
  );
}
