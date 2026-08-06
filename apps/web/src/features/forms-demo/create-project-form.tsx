'use client';

import { JsonForms } from '@jsonforms/react';
import { tokenCells, tokenRenderers } from '@poc-plattform-kit/forms';
import { useMutation } from '@tanstack/react-query';
import { useMemo, useState, type FormEvent } from 'react';
import { createProjectJsonSchema, createProjectSchema, type CreateProjectInput } from './schemas';
import { createProjectUiSchema } from './uischema';

const initialData: CreateProjectInput = {
  name: '',
  category: 'Internal',
  active: true,
  launchDate: '',
  tags: [''],
};

async function createDemoProject(project: CreateProjectInput) {
  await Promise.resolve();
  return project;
}

export function CreateProjectForm() {
  const [data, setData] = useState<Record<string, unknown>>(initialData);
  const [validationError, setValidationError] = useState<string | null>(null);
  const schema = useMemo(() => createProjectJsonSchema, []);
  const mutation = useMutation({ mutationFn: createDemoProject });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = createProjectSchema.safeParse(data);
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0]?.message ?? 'Check the form fields.');
      return;
    }

    setValidationError(null);
    mutation.mutate(parsed.data);
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <JsonForms
        schema={schema}
        uischema={createProjectUiSchema}
        data={data}
        renderers={tokenRenderers}
        cells={tokenCells}
        onChange={({ data: next }) => setData(next as Record<string, unknown>)}
      />
      <button
        type="submit"
        className="rounded bg-accent px-4 py-2 font-medium text-accent-on disabled:opacity-50"
        disabled={mutation.isPending}
      >
        {mutation.isPending ? 'Creating…' : 'Create demo project'}
      </button>
      {validationError ? (
        <p className="text-sm text-fg" role="alert">
          {validationError}
        </p>
      ) : null}
      {mutation.isSuccess ? (
        <p className="text-sm text-fg" role="status">
          Demo project created. No data was sent to the API.
        </p>
      ) : null}
    </form>
  );
}
