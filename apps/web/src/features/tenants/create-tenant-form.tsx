'use client';

import { JsonForms } from '@jsonforms/react';
import { tokenCells, tokenRenderers } from '@poc-plattform-kit/forms';
import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { AlertIcon } from '@/components/icons';
import {
  createTenantJsonSchema,
  createTenantSchema,
  toCreateTenantPayload,
  type CreateTenantInput,
} from './schemas';
import { createTenantUiSchema } from './uischema';

export type CreateTenantFormHandle = {
  submit: () => void;
};

type CreateTenantFormProps = {
  pending?: boolean;
  errorMessage?: string | null;
  onSubmit: (data: CreateTenantInput) => void;
};

/** Create Tenant fields, hosted inside TenantCreateDrawer which owns submit/cancel actions. */
export const CreateTenantForm = forwardRef<CreateTenantFormHandle, CreateTenantFormProps>(
  function CreateTenantForm({ pending = false, errorMessage = null, onSubmit }, ref) {
    const [data, setData] = useState<Record<string, unknown>>({ name: '', slug: '' });
    const dataRef = useRef(data);
    const [clientError, setClientError] = useState<string | null>(null);
    const schema = useMemo(() => createTenantJsonSchema, []);

    useImperativeHandle(ref, () => ({
      submit() {
        const parsed = createTenantSchema.safeParse(toCreateTenantPayload(dataRef.current));
        if (!parsed.success) {
          setClientError(parsed.error.issues[0]?.message ?? 'Invalid form');
          return;
        }
        setClientError(null);
        onSubmit(parsed.data);
      },
    }));

    return (
      <div className="flex flex-col gap-3" data-testid="tenant-create-form">
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
      </div>
    );
  },
);
