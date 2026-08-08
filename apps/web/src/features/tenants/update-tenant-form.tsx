'use client';

import { JsonForms } from '@jsonforms/react';
import { tokenCells, tokenRenderers } from '@poc-plattform-kit/forms';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { AlertIcon } from '@/components/icons';
import { updateTenantJsonSchema, updateTenantSchema, type UpdateTenantInput } from './schemas';
import { updateTenantUiSchema } from './uischema';

export type UpdateTenantFormHandle = {
  submit: () => void;
};

type UpdateTenantFormProps = {
  initialName?: string;
  pending?: boolean;
  errorMessage?: string | null;
  onSubmit: (data: UpdateTenantInput) => void;
};

/** Editable "name" field for Tenant Details, hosted inside TenantDetailsDrawer. */
export const UpdateTenantForm = forwardRef<UpdateTenantFormHandle, UpdateTenantFormProps>(
  function UpdateTenantForm(
    { initialName = '', pending = false, errorMessage = null, onSubmit },
    ref,
  ) {
    const [data, setData] = useState<Record<string, unknown>>({ name: initialName });
    const dataRef = useRef(data);
    const [clientError, setClientError] = useState<string | null>(null);
    const schema = useMemo(() => updateTenantJsonSchema, []);

    useEffect(() => {
      const next = { name: initialName };
      dataRef.current = next;
      setData(next);
    }, [initialName]);

    useImperativeHandle(ref, () => ({
      submit() {
        const parsed = updateTenantSchema.safeParse(dataRef.current);
        if (!parsed.success) {
          setClientError(parsed.error.issues[0]?.message ?? 'Invalid form');
          return;
        }
        setClientError(null);
        onSubmit(parsed.data);
      },
    }));

    return (
      <div className="flex flex-col gap-3" data-testid="tenant-update-form">
        <JsonForms
          schema={schema}
          uischema={updateTenantUiSchema}
          data={data}
          renderers={tokenRenderers}
          cells={tokenCells}
          readonly={pending}
          validationMode="ValidateAndHide"
          onChange={({ data: next }) => {
            const record = next as Record<string, unknown>;
            dataRef.current = record;
            setData(record);
          }}
        />
        {clientError ? (
          <p
            className="flex items-center gap-2 text-sm text-fg"
            data-testid="tenant-update-client-error"
            role="alert"
          >
            <AlertIcon className="h-4 w-4 shrink-0" />
            {clientError}
          </p>
        ) : null}
        {errorMessage ? (
          <p
            className="flex items-center gap-2 text-sm text-fg"
            data-testid="tenant-update-error"
            role="alert"
          >
            <AlertIcon className="h-4 w-4 shrink-0" />
            {errorMessage}
          </p>
        ) : null}
      </div>
    );
  },
);
