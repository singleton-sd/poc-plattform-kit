'use client';

import Link from 'next/link';
import { useMe } from '@/features/auth/me';
import { TenantLookup } from '@/features/support/tenant-lookup';

const SUPPORT_ROLE = 'support-agent';

export default function SupportPage() {
  const { data: me, isLoading, isError } = useMe();

  if (isLoading) {
    return (
      <main className="p-6 text-fg-muted" data-testid="support-loading">
        Loading…
      </main>
    );
  }

  if (isError) {
    return (
      <main className="p-6" data-testid="support-error">
        <h1 className="font-heading text-xl font-semibold text-fg">Unable to verify access</h1>
        <p className="text-fg-muted">Could not load your session. Try again later.</p>
        <p className="mt-4">
          <Link href="/" className="text-accent underline" data-testid="support-login-link">
            Sign in
          </Link>
        </p>
      </main>
    );
  }

  if (me?.role !== SUPPORT_ROLE) {
    return (
      <main className="p-6" data-testid="support-restricted">
        <h1 className="font-heading text-xl font-semibold text-fg">Access restricted</h1>
        <p className="text-fg-muted">This area requires the {SUPPORT_ROLE} role.</p>
        <p className="mt-4">
          <Link href="/" className="text-accent underline" data-testid="support-login-link">
            {me ? 'Switch account' : 'Sign in'}
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="p-6" data-testid="support-shell">
      <h1 className="font-heading text-xl font-semibold text-fg">Support</h1>
      <p className="text-fg-muted">Look up a tenant to begin support.</p>
      <TenantLookup />
    </main>
  );
}
