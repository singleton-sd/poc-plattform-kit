'use client';

import { JsonForms } from '@jsonforms/react';
import { tokenCells, tokenRenderers } from '@poc-plattform-kit/forms';
import { useMutation } from '@tanstack/react-query';
import { useMemo, useState, type FormEvent } from 'react';
import { createProjectJsonSchema, createProjectSchema, type CreateProjectInput } from './schemas';
import { createProjectUiSchema } from './uischema';

export const emptyCreateProjectData: CreateProjectInput = {
  name: '',
  category: 'Internal',
  active: true,
  launchDate: '',
  tags: [''],
};

/** Fixed calendar value keeps Storybook / Chromatic output deterministic. */
export const populatedCreateProjectData: CreateProjectInput = {
  name: 'Platform Kit Demo',
  category: 'Customer',
  active: true,
  launchDate: '2026-03-01',
  tags: ['storybook', 'baseline'],
};

async function createDemoProject(project: CreateProjectInput) {
  await Promise.resolve();
  return project;
}

export type CreateProjectFormProps = {
  initialData?: CreateProjectInput;
  /** Disables JSON Forms controls for read-only review states. */
  readOnly?: boolean;
};

export function CreateProjectForm({
  initialData = emptyCreateProjectData,
  readOnly = false,
}: CreateProjectFormProps) {
  const [data, setData] = useState<Record<string, unknown>>(initialData);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const schema = useMemo(() => createProjectJsonSchema, []);
  const mutation = useMutation({ mutationFn: createDemoProject });
  const isValid = createProjectSchema.safeParse(data).success;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readOnly) return;
    setSubmitAttempted(true);
    mutation.reset();
    const parsed = createProjectSchema.safeParse(data);
    if (!parsed.success) {
      setValidationErrors([...new Set(parsed.error.issues.map((issue) => issue.message))]);
      return;
    }

    setValidationErrors([]);
    mutation.mutate(parsed.data);
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit} data-testid="create-project-form">
      <JsonForms
        schema={schema}
        uischema={createProjectUiSchema}
        data={data}
        renderers={tokenRenderers}
        cells={tokenCells}
        readonly={readOnly}
        // Hide until a submit attempt so empty required fields don't greet the user with errors.
        validationMode={submitAttempted ? 'ValidateAndShow' : 'ValidateAndHide'}
        onChange={({ data: next }) => {
          if (readOnly) return;
          // JsonForms also emits onChange after our own setState. Ignore
          // no-op echoes so submit-time validation (and mutation success)
          // are not cleared on the same click that produced them.
          if (JSON.stringify(next) === JSON.stringify(data)) return;
          if (validationErrors.length > 0) setValidationErrors([]);
          setData(next as Record<string, unknown>);
        }}
      />
      <button
        type="submit"
        className="rounded bg-accent px-4 py-2 font-medium text-accent-on disabled:opacity-50"
        disabled={mutation.isPending || readOnly || !isValid}
        data-testid="create-project-submit"
      >
        {mutation.isPending ? 'Creating…' : 'Create demo project'}
      </button>
      {validationErrors.length > 0 ? (
        <div className="text-sm text-fg" role="alert" data-testid="create-project-validation-error">
          <ul className="list-disc space-y-1 pl-5">
            {validationErrors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {mutation.isSuccess ? (
        <p className="text-sm text-fg" role="status" data-testid="create-project-success">
          Demo project created. No data was sent to the API.
        </p>
      ) : null}
    </form>
  );
}
