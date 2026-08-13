import { isDateControl, rankWith, type ControlProps, type RankedTester } from '@jsonforms/core';
import { withJsonFormsControlProps } from '@jsonforms/react';
import { cn } from '../cn';
import { useFieldErrorState } from '../form-interaction';

export type DateControlRendererProps = ControlProps & {
  showError?: boolean;
  onFieldBlur?: () => void;
};

export function DateControlRenderer(props: DateControlRendererProps) {
  const { data, handleChange, path, label, required, errors, enabled, id } = props;
  const inputId = id || path;
  const invalid = Boolean(errors);
  const showError = props.showError ?? invalid;

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm text-fg" htmlFor={inputId}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      <input
        id={inputId}
        type="date"
        className={cn(
          'rounded border bg-bg px-3 py-2 text-fg',
          showError ? 'border-fg' : 'border-fg-subtle',
        )}
        value={data ?? ''}
        disabled={!enabled}
        aria-required={required || undefined}
        aria-invalid={showError}
        aria-describedby={showError ? `${inputId}-error` : undefined}
        onBlur={props.onFieldBlur}
        onChange={(event) => handleChange(path, event.target.value)}
      />
      {showError ? (
        <p id={`${inputId}-error`} className="text-sm text-fg" role="alert">
          {errors}
        </p>
      ) : null}
    </div>
  );
}

function DateControlWithInteraction(props: ControlProps) {
  const { showError, onBlur } = useFieldErrorState(props.path, props.errors);
  return <DateControlRenderer {...props} showError={showError} onFieldBlur={onBlur} />;
}

export const dateControlTester: RankedTester = rankWith(6, isDateControl);
export const DateControl = withJsonFormsControlProps(DateControlWithInteraction);
