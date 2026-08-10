import { isStringControl, rankWith, type ControlProps, type RankedTester } from '@jsonforms/core';
import { withJsonFormsControlProps } from '@jsonforms/react';
import { cn } from '../cn';

export function TextControlRenderer(props: ControlProps) {
  const { data, handleChange, path, label, required, errors, enabled, id, description } = props;
  const inputId = id || path;
  const invalid = Boolean(errors);

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
        disabled={!enabled}
        required={required}
        aria-required={required || undefined}
        aria-invalid={invalid}
        aria-describedby={invalid ? `${inputId}-error` : undefined}
        onChange={(event) => handleChange(path, event.target.value)}
      />
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
