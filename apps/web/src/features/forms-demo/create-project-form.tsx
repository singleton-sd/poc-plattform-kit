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
  const [validationError, setValidationError] = useState<string | null>(null);
  const schema = useMemo(() => createProjectJsonSchema, []);
  const mutation = useMutation({ mutationFn: createDemoProject });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readOnly) return;
    mutation.reset();
    const parsed = createProjectSchema.safeParse(data);
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0]?.message ?? 'Check the form fields.');
      return;
    }

    setValidationError(null);
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
        onChange={({ data: next }) => {
          if (readOnly) return;
          // Do NOT call mutation.reset() here — JsonForms fires onChange on
          // every render cycle (not just user interactions), which would clear
          // mutation.isSuccess immediately after the mutation completes and
          // prevent the success message from ever being visible.
          if (validationError) setValidationError(null);
          setData(next as Record<string, unknown>);
        }}
      />
      <button
        type="submit"
        className="rounded bg-accent px-4 py-2 font-medium text-accent-on disabled:opacity-50"
        disabled={mutation.isPending || readOnly}
        data-testid="create-project-submit"
      >
        {mutation.isPending ? 'Creating…' : 'Create demo project'}
      </button>
      {validationError ? (
        <p className="text-sm text-fg" role="alert" data-testid="create-project-validation-error">
          {validationError}
        </p>
      ) : null}
      {mutation.isSuccess ? (
        <p className="text-sm text-fg" role="status" data-testid="create-project-success">
          Demo project created. No data was sent to the API.
        </p>
      ) : null}
    </form>
  );
}
