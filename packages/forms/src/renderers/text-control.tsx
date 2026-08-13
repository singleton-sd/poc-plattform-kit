import { isStringControl, rankWith, type ControlProps, type RankedTester } from '@jsonforms/core';
import { withJsonFormsControlProps } from '@jsonforms/react';
import { cn } from '../cn';
import { useFieldErrorState } from '../form-interaction';

export type TextControlRendererProps = ControlProps & {
  showError?: boolean;
  onFieldBlur?: () => void;
};

export function TextControlRenderer(props: TextControlRendererProps) {
  const { data, handleChange, path, label, required, errors, enabled, id, description, schema } =
    props;
  const inputId = id || path;
  const invalid = Boolean(errors);
  const showError = props.showError ?? invalid;
  const maxLength = schema?.maxLength;
  const describedBy =
    [showError ? `${inputId}-error` : null, maxLength ? `${inputId}-count` : null]
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
          showError ? 'border-fg' : 'border-fg-subtle',
        )}
        value={data ?? ''}
        maxLength={maxLength}
        disabled={!enabled}
        aria-required={required || undefined}
        aria-invalid={showError}
        aria-describedby={describedBy}
        onBlur={props.onFieldBlur}
        onChange={(event) => handleChange(path, event.target.value)}
      />
      {maxLength ? (
        <p id={`${inputId}-count`} className="text-xs text-fg-muted">
          {String(data ?? '').length}/{maxLength}
        </p>
      ) : null}
      {showError ? (
        <p id={`${inputId}-error`} className="text-sm text-fg" role="alert">
          {errors}
        </p>
      ) : null}
    </div>
  );
}

function TextControlWithInteraction(props: ControlProps) {
  const { showError, onBlur } = useFieldErrorState(props.path, props.errors);
  return <TextControlRenderer {...props} showError={showError} onFieldBlur={onBlur} />;
}

export const textControlTester: RankedTester = rankWith(3, isStringControl);
export const TextControl = withJsonFormsControlProps(TextControlWithInteraction);
