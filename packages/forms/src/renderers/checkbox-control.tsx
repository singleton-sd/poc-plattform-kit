import { isBooleanControl, rankWith, type ControlProps, type RankedTester } from '@jsonforms/core';
import { withJsonFormsControlProps } from '@jsonforms/react';

function CheckboxControlRenderer(props: ControlProps) {
  const { data, handleChange, path, label, errors, enabled, id } = props;
  const inputId = id || path;
  const invalid = Boolean(errors);

  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-center gap-2 text-sm text-fg" htmlFor={inputId}>
        <input
          id={inputId}
          type="checkbox"
          className="size-4 accent-accent"
          checked={Boolean(data)}
          disabled={!enabled}
          aria-invalid={invalid}
          aria-describedby={invalid ? `${inputId}-error` : undefined}
          onChange={(event) => handleChange(path, event.target.checked)}
        />
        {label}
      </label>
      {invalid ? (
        <p id={`${inputId}-error`} className="text-sm text-fg" role="alert">
          {errors}
        </p>
      ) : null}
    </div>
  );
}

export const checkboxControlTester: RankedTester = rankWith(5, isBooleanControl);
export const CheckboxControl = withJsonFormsControlProps(CheckboxControlRenderer);
