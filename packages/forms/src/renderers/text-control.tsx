import { isStringControl, rankWith, type ControlProps, type RankedTester } from '@jsonforms/core';
import { withJsonFormsControlProps } from '@jsonforms/react';
import { cn } from '../cn';

export function TextControlRenderer(props: ControlProps) {
  const { data, handleChange, path, label, required, errors, enabled, id, description, schema } =
    props;
  const inputId = id || path;
  const invalid = Boolean(errors);
  const maxLength = schema?.maxLength;
  const describedBy =
    [invalid ? `${inputId}-error` : null, maxLength ? `${inputId}-count` : null]
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm text-fg" htmlFor={inputId}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      {description ? <p className="text-xs text-fg-muted">{description}</p> : null}
      <input
        id={inputId}
        className={cn(
          'rounded border bg-bg px-3 py-2 text-fg',
          invalid ? 'border-fg' : 'border-fg-subtle',
        )}
        value={data ?? ''}
        maxLength={maxLength}
        disabled={!enabled}
        aria-required={required || undefined}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onChange={(event) => handleChange(path, event.target.value)}
      />
      {maxLength ? (
        <p id={`${inputId}-count`} className="text-xs text-fg-muted">
          {String(data ?? '').length}/{maxLength}
        </p>
      ) : null}
      {invalid ? (
        <p id={`${inputId}-error`} className="text-sm text-fg" role="alert">
          {errors}
        </p>
      ) : null}
    </div>
  );
}

export const textControlTester: RankedTester = rankWith(3, isStringControl);
export const TextControl = withJsonFormsControlProps(TextControlRenderer);
