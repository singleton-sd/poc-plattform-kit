'use client';

import { useEffect, useState } from 'react';
import { CheckIcon, CopyIcon } from '@/components/icons';
import { cn } from '@poc-plattform-kit/forms';

type CopyTenantIdButtonProps = {
  tenantId: string;
};

/** Copies the tenant id and gives an accessible, transient confirmation. */
export function CopyTenantIdButton({ tenantId }: CopyTenantIdButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(tenantId);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        'inline-flex items-center gap-1.5 rounded border border-fg-subtle px-2 py-1 text-xs font-medium text-fg-muted hover:text-fg',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
      )}
      aria-label={copied ? 'Tenant ID copied' : 'Copy tenant ID'}
      data-testid="tenant-copy-id"
    >
      {copied ? <CheckIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
      {copied ? 'Copied' : 'Copy'}
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? 'Tenant ID copied to clipboard' : ''}
      </span>
    </button>
  );
}
