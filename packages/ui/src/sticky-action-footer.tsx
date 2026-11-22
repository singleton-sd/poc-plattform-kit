'use client';

import { useId } from 'react';

export const WIZARD_FOOTER_HEIGHT = '5.5rem';

export type StickyActionFooterProps = {
  onBack: () => void;
  backLabel?: string;
  primaryLabel: string;
  onPrimary: () => void;
  primaryUnavailableReason?: string;
};

const FOCUS =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';
const TARGET = 'inline-flex min-h-11 min-w-11 items-center justify-center rounded px-3 text-sm';

export function StickyActionFooter({
  onBack,
  backLabel = 'Back',
  primaryLabel,
  onPrimary,
  primaryUnavailableReason,
}: StickyActionFooterProps) {
  const unavailable = Boolean(primaryUnavailableReason);
  const reasonId = useId();

  return (
    <footer
      className="sticky bottom-0 z-30 flex min-h-[5.5rem] flex-wrap items-center justify-between gap-3 border-t border-fg-subtle/30 bg-bg px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      data-kit-ui="wizard-footer"
      data-testid="sticky-action-footer"
    >
      <button type="button" onClick={onBack} className={`${TARGET} text-fg ${FOCUS}`}>
        {backLabel}
      </button>
      <div className="flex min-w-0 flex-col items-end gap-1">
        {unavailable ? (
          <p id={reasonId} className="text-sm text-fg">
            {primaryUnavailableReason}
          </p>
        ) : null}
        <button
          type="button"
          aria-disabled={unavailable || undefined}
          aria-describedby={unavailable ? reasonId : undefined}
          onClick={() => {
            if (!unavailable) onPrimary();
          }}
          className={`${TARGET} bg-accent px-4 text-accent-on ${FOCUS}`}
        >
          {primaryLabel}
        </button>
      </div>
    </footer>
  );
}
