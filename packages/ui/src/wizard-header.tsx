'use client';

import type { ReactNode } from 'react';

export const WIZARD_HEADER_HEIGHT = '4.75rem';

export type WizardHeaderProps = {
  logo: ReactNode;
  title?: string;
  autosaveStatus: string;
  onSaveAndExit: () => void;
  saveAndExitLabel?: string;
};

const FOCUS =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

export function WizardHeader({
  logo,
  title = 'Prepare contract',
  autosaveStatus,
  onSaveAndExit,
  saveAndExitLabel = 'Save and exit',
}: WizardHeaderProps) {
  return (
    <header
      className="sticky top-0 z-30 flex min-h-[4.75rem] flex-wrap items-center gap-3 border-b border-fg-subtle/30 bg-bg px-4 py-2 text-fg"
      data-testid="wizard-header"
    >
      <div className="flex min-h-11 min-w-11 items-center">{logo}</div>
      <p className="font-heading text-base font-semibold">{title}</p>
      <p className="text-sm text-fg" aria-live="polite">
        {autosaveStatus}
      </p>
      <button
        type="button"
        onClick={onSaveAndExit}
        className={`ml-auto inline-flex min-h-11 min-w-11 items-center justify-center rounded px-3 text-sm text-fg ${FOCUS}`}
      >
        {saveAndExitLabel}
      </button>
    </header>
  );
}
