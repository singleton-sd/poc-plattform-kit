'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { ChevronLeftIcon, CloseIcon } from './icons';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export type DrawerProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Element id containing supplementary description text, if any. */
  describedById?: string;
  /** Stable labelled-by id for deterministic Storybook / Chromatic output. */
  titleId?: string;
  testId?: string;
};

/**
 * Accessible panel that renders as a right-side drawer on desktop (sm+) and a
 * dedicated full-width screen on mobile via responsive classes — one
 * component satisfies both layouts in the approved design contract.
 */
export function Drawer({
  open,
  title,
  onClose,
  children,
  footer,
  describedById,
  titleId: titleIdProp,
  testId,
}: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const generatedTitleId = useId();
  const titleId = titleIdProp ?? generatedTitleId;
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    // Focus the first focusable field in the body content (e.g. a form's
    // first input) rather than the header, whose Back/Close buttons are
    // each hidden on one breakpoint.
    const focusable = contentRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    (focusable?.[0] ?? panel)?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;

      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (node) => node.offsetParent !== null,
      );
      if (nodes.length === 0) return;

      const first = nodes[0];
      const last = nodes[nodes.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40" data-testid={testId}>
      {/* Visual dismiss region only — keyboard/AT users close via Escape or the header buttons below. */}
      <div
        aria-hidden="true"
        data-testid="drawer-backdrop"
        className="absolute inset-0 h-full w-full bg-bg-subtle/70 sm:backdrop-blur-[1px]"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedById}
        className="fixed inset-y-0 right-0 flex w-full flex-col bg-bg text-fg shadow-xl outline-none sm:w-[420px] sm:border-l sm:border-fg-subtle/30"
        tabIndex={-1}
      >
        <header className="flex items-center gap-3 border-b border-fg-subtle/30 px-4 py-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            aria-label="Back"
            className="rounded p-1 text-fg-muted hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent sm:hidden"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <h2 id={titleId} className="font-heading flex-1 text-lg font-semibold text-fg">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="hidden rounded p-1 text-fg-muted hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent sm:block"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </header>
        <div
          ref={contentRef}
          className="flex-1 overflow-y-auto px-4 py-4 sm:px-6"
          data-testid={testId ? `${testId}-body` : undefined}
        >
          {children}
        </div>
        {footer ? (
          <footer
            className="sticky bottom-0 flex flex-col gap-2 border-t border-fg-subtle/30 bg-bg px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6"
            data-testid={testId ? `${testId}-footer` : undefined}
          >
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
