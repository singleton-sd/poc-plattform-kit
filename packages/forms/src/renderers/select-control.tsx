import { isEnumControl, rankWith, type ControlProps, type RankedTester } from '@jsonforms/core';
import { withJsonFormsControlProps } from '@jsonforms/react';

export function enumValueAt(options: unknown[], selectedIndex: string): unknown {
  if (selectedIndex === '') return undefined;
  return options[Number(selectedIndex)];
}
import { cn } from '../cn';

function SelectControlRenderer(props: ControlProps) {
  const { data, handleChange, path, label, required, errors, enabled, id, schema } = props;
  const inputId = id || path;
  const invalid = Boolean(errors);
  const options = schema.enum ?? [];

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm text-fg" htmlFor={inputId}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      <select
        id={inputId}
        className={cn(
          'rounded border bg-bg px-3 py-2 text-fg',
          invalid ? 'border-fg' : 'border-fg-subtle',
        )}
        value={
          data === undefined ? '' : String(options.findIndex((option) => Object.is(option, data)))
        }
        disabled={!enabled}
        aria-invalid={invalid}
        aria-describedby={invalid ? `${inputId}-error` : undefined}
        onChange={(event) => handleChange(path, enumValueAt(options, event.target.value))}
      >
        <option value="">Select an option</option>
        {options.map((option, index) => (
          <option key={`${typeof option}-${String(option)}`} value={index}>
            {String(option)}
          </option>
        ))}
      </select>
      {invalid ? (
        <p id={`${inputId}-error`} className="text-sm text-fg" role="alert">
          {errors}
        </p>
      ) : null}
    </div>
  );
}

export const selectControlTester: RankedTester = rankWith(5, isEnumControl);
export const SelectControl = withJsonFormsControlProps(SelectControlRenderer);
