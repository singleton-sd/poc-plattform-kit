'use client';

import { JsonForms } from '@jsonforms/react';
import {
  FormInteractionProvider,
  tokenCells,
  tokenRenderers,
  useFormInteraction,
} from '@poc-plattform-kit/forms';
import { useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { AlertIcon } from '@/components/icons';
import {
  createTenantJsonSchema,
  createTenantSchema,
  toCreateTenantPayload,
  uniqueIssueMessages,
  type CreateTenantInput,
} from './schemas';
import { createTenantUiSchema } from './uischema';

export const CREATE_TENANT_FORM_ID = 'tenant-create-form';

type CreateTenantFormProps = {
  pending?: boolean;
  errorMessage?: string | null;
  onSubmit: (data: CreateTenantInput) => void;
  onValidityChange?: (isValid: boolean) => void;
  /** Optional seed used by tests; production hosts start from a blank name. */
  initialData?: Record<string, unknown>;
};

function CreateTenantFormFields({
  pending = false,
  errorMessage = null,
  onSubmit,
  onValidityChange,
  initialData,
}: CreateTenantFormProps) {
  const interaction = useFormInteraction();
  const [data, setData] = useState<Record<string, unknown>>(initialData ?? { name: '' });
  const dataRef = useRef(data);
  const [clientErrors, setClientErrors] = useState<string[]>([]);
  const schema = useMemo(() => createTenantJsonSchema, []);
  const isValid = createTenantSchema.safeParse(toCreateTenantPayload(data)).success;

  useLayoutEffect(() => {
    onValidityChange?.(isValid);
  }, [isValid, onValidityChange]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    interaction?.setSubmitAttempted(true);
    const parsed = createTenantSchema.safeParse(toCreateTenantPayload(dataRef.current));
    if (!parsed.success) {
      setClientErrors(uniqueIssueMessages(parsed.error));
      return;
    }
    setClientErrors([]);
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
        validationMode="ValidateAndShow"
        onChange={({ data: next }) => {
          const record = { ...dataRef.current, ...(next as Record<string, unknown>) };
          dataRef.current = record;
          setData(record);
        }}
      />
      {clientErrors.length > 0 ? (
        <div
          className="flex items-start gap-2 text-sm text-fg"
          data-testid="tenant-create-client-error"
          role="alert"
        >
          <AlertIcon className="h-4 w-4 shrink-0" />
          {clientErrors.length === 1 ? (
            clientErrors[0]
          ) : (
            <ul className="list-disc space-y-1 pl-5">
              {clientErrors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}
        </div>
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

/**
 * Create Tenant fields, hosted inside TenantCreateDrawer which owns the
 * footer's submit/cancel buttons via the HTML `form` attribute — this stays
 * a real <form> so Enter-to-submit keeps working for keyboard users.
 */
export function CreateTenantForm(props: CreateTenantFormProps) {
  return (
    <FormInteractionProvider>
      <CreateTenantFormFields {...props} />
    </FormInteractionProvider>
  );
}
