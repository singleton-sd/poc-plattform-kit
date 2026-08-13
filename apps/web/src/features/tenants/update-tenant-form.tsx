'use client';

import { JsonForms } from '@jsonforms/react';
import {
  FormInteractionProvider,
  tokenCells,
  tokenRenderers,
  useFormInteraction,
} from '@poc-plattform-kit/forms';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { AlertIcon } from '@/components/icons';
import {
  uniqueIssueMessages,
  updateTenantJsonSchema,
  updateTenantSchema,
  type UpdateTenantInput,
} from './schemas';
import { updateTenantUiSchema } from './uischema';

export const UPDATE_TENANT_FORM_ID = 'tenant-update-form';

type UpdateTenantFormProps = {
  initialName?: string;
  pending?: boolean;
  errorMessage?: string | null;
  onSubmit: (data: UpdateTenantInput) => void;
  onValidityChange?: (isValid: boolean) => void;
};

function UpdateTenantFormFields({
  initialName = '',
  pending = false,
  errorMessage = null,
  onSubmit,
  onValidityChange,
}: UpdateTenantFormProps) {
  const interaction = useFormInteraction();
  const [data, setData] = useState<Record<string, unknown>>({ name: initialName });
  const dataRef = useRef(data);
  const [clientErrors, setClientErrors] = useState<string[]>([]);
  const schema = useMemo(() => updateTenantJsonSchema, []);
  const isValid = updateTenantSchema.safeParse(data).success;

  useEffect(() => {
    const next = { name: initialName };
    dataRef.current = next;
    setData(next);
  }, [initialName]);

  useLayoutEffect(() => {
    onValidityChange?.(isValid);
  }, [isValid, onValidityChange]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    interaction?.setSubmitAttempted(true);
    const parsed = updateTenantSchema.safeParse(dataRef.current);
    if (!parsed.success) {
      setClientErrors(uniqueIssueMessages(parsed.error));
      return;
    }
    setClientErrors([]);
    onSubmit(parsed.data);
  }

  return (
    <form
      id={UPDATE_TENANT_FORM_ID}
      className="flex flex-col gap-3"
      onSubmit={handleSubmit}
      data-testid="tenant-update-form"
    >
      <JsonForms
        schema={schema}
        uischema={updateTenantUiSchema}
        data={data}
        renderers={tokenRenderers}
        cells={tokenCells}
        readonly={pending}
        validationMode="ValidateAndShow"
        onChange={({ data: next }) => {
          const record = next as Record<string, unknown>;
          dataRef.current = record;
          setData(record);
        }}
      />
      {clientErrors.length > 0 ? (
        <div
          className="flex items-start gap-2 text-sm text-fg"
          data-testid="tenant-update-client-error"
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
          data-testid="tenant-update-error"
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
 * Editable "name" field for Tenant Details, hosted inside TenantDetailsDrawer
 * which owns the footer's Save/Cancel buttons via the HTML `form` attribute
 * — this stays a real <form> so Enter-to-submit keeps working.
 */
export function UpdateTenantForm(props: UpdateTenantFormProps) {
  return (
    <FormInteractionProvider>
      <UpdateTenantFormFields {...props} />
    </FormInteractionProvider>
  );
}
