import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type FormInteractionContextValue = {
  isTouched: (path: string) => boolean;
  markTouched: (path: string) => void;
  submitAttempted: boolean;
  setSubmitAttempted: (attempted: boolean) => void;
};

const FormInteractionContext = createContext<FormInteractionContextValue | null>(null);

/**
 * When no host is tracking interaction, preserve current renderer behaviour:
 * show an error whenever JSON Forms passes a non-empty `errors` string.
 * Hosts that wrap with `FormInteractionProvider` (and typically
 * `validationMode="ValidateAndShow"`) hide until blur or a submit attempt.
 */
export function shouldShowFieldError(
  invalid: boolean,
  interaction: { touched: boolean; submitAttempted: boolean } | null,
): boolean {
  if (!invalid) return false;
  if (interaction == null) return true;
  return interaction.touched || interaction.submitAttempted;
}

export function FormInteractionProvider({ children }: { children: ReactNode }) {
  const [touchedPaths, setTouchedPaths] = useState<ReadonlySet<string>>(() => new Set());
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const isTouched = useCallback((path: string) => touchedPaths.has(path), [touchedPaths]);
  const markTouched = useCallback((path: string) => {
    setTouchedPaths((current) => {
      if (current.has(path)) return current;
      const next = new Set(current);
      next.add(path);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ isTouched, markTouched, submitAttempted, setSubmitAttempted }),
    [isTouched, markTouched, submitAttempted],
  );

  return (
    <FormInteractionContext.Provider value={value}>{children}</FormInteractionContext.Provider>
  );
}

export function useFormInteraction(): FormInteractionContextValue | null {
  return useContext(FormInteractionContext);
}

export function useTouched(path: string): boolean {
  return useFormInteraction()?.isTouched(path) ?? false;
}

export function useFormSubmitAttempted(): boolean {
  return useFormInteraction()?.submitAttempted ?? false;
}

function noopMarkTouched(_path: string): void {}

export function useMarkTouched(): (path: string) => void {
  return useFormInteraction()?.markTouched ?? noopMarkTouched;
}

export function useFieldErrorState(path: string, errors: unknown) {
  const ctx = useFormInteraction();
  const invalid = Boolean(errors);
  const showError = shouldShowFieldError(
    invalid,
    ctx == null ? null : { touched: ctx.isTouched(path), submitAttempted: ctx.submitAttempted },
  );

  return {
    showError,
    onBlur: () => {
      ctx?.markTouched(path);
    },
  };
}
