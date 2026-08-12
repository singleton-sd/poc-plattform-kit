import {
  and,
  isPrimitiveArrayControl,
  rankWith,
  schemaMatches,
  type ControlProps,
  type JsonSchema,
  type RankedTester,
} from '@jsonforms/core';
import { withJsonFormsControlProps } from '@jsonforms/react';

export function isStringArraySchema(schema: JsonSchema): boolean {
  return (
    schema.type === 'array' &&
    !Array.isArray(schema.items) &&
    typeof schema.items === 'object' &&
    schema.items?.type === 'string'
  );
}

export function ArrayControlRenderer(props: ControlProps) {
  const { data, handleChange, path, label, required, errors, enabled, id } = props;
  const inputId = id || path;
  const values = Array.isArray(data) ? (data as unknown[]) : [];
  const invalid = Boolean(errors);

  function update(index: number, value: string) {
    handleChange(
      path,
      values.map((item, itemIndex) => (itemIndex === index ? value : item)),
    );
  }

  return (
    <fieldset
      className="flex flex-col gap-2"
      aria-describedby={invalid ? `${inputId}-error` : undefined}
    >
      <legend className="text-sm text-fg">
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </legend>
      {values.map((value, index) => (
        <div className="flex gap-2" key={`${inputId}-${index}`}>
          <label className="sr-only" htmlFor={`${inputId}-${index}`}>
            {label} item {index + 1}
          </label>
          <input
            id={`${inputId}-${index}`}
            className="min-w-0 flex-1 rounded border border-fg-subtle bg-bg px-3 py-2 text-fg"
            value={String(value ?? '')}
            disabled={!enabled}
            onChange={(event) => update(index, event.target.value)}
          />
          <button
            type="button"
            className="rounded border border-fg-subtle px-3 py-2 text-sm text-fg"
            disabled={!enabled}
            onClick={() =>
              handleChange(
                path,
                values.filter((_, itemIndex) => itemIndex !== index),
              )
            }
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className="w-fit rounded border border-fg-subtle px-3 py-2 text-sm text-fg"
        disabled={!enabled}
        onClick={() => handleChange(path, [...values, ''])}
      >
        Add {label.toLowerCase()}
      </button>
      {invalid ? (
        <p id={`${inputId}-error`} className="text-sm text-fg" role="alert">
          {errors}
        </p>
      ) : null}
    </fieldset>
  );
}

export const arrayControlTester: RankedTester = rankWith(
  5,
  and(isPrimitiveArrayControl, schemaMatches(isStringArraySchema)),
);
export const ArrayControl = withJsonFormsControlProps(ArrayControlRenderer);
