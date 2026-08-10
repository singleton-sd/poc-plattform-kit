'use client';

import type { ReactNode } from 'react';

type TooltipProps = {
  content: string;
  children: ReactNode;
};

/** Lightweight token-styled tooltip for gated controls. */
export function Tooltip({ content, children }: TooltipProps) {
  return (
    <span className="group relative inline-flex max-w-full">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-max max-w-xs -translate-x-1/2 rounded bg-fg px-2 py-1 text-xs text-bg shadow group-hover:block group-focus-within:block"
      >
        {content}
      </span>
    </span>
  );
}
