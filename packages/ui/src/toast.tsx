'use client';

import { useEffect } from 'react';
import { CheckIcon, CloseIcon } from './icons';

export type ToastProps = {
  message: string | null;
  onDismiss: () => void;
  /** Auto-dismiss delay in ms. */
  duration?: number;
  testId?: string;
};

/** Lightweight success feedback surface — announced via aria-live, auto-dismisses. */
export function Toast({ message, onDismiss, duration = 4000, testId }: ToastProps) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid={testId}
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 sm:justify-end sm:pr-6"
    >
      {message ? (
        <div className="pointer-events-auto flex items-center gap-2 rounded bg-fg px-4 py-3 text-sm font-medium text-bg shadow-lg">
          <CheckIcon className="h-4 w-4 shrink-0" />
          <span>{message}</span>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss notification"
            className="ml-1 rounded p-0.5 text-bg/80 hover:text-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            <CloseIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
