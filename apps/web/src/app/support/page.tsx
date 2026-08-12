'use client';

import Link from 'next/link';
import { AppShellHeader } from '@/components/app-shell-header';
import { AuthenticationGuard } from '@/features/auth/authentication-guard';
import { useMe } from '@/features/auth/me';
import { TenantLookup } from '@/features/support/tenant-lookup';

const SUPPORT_ROLE = 'support-agent';

function SupportPageContent() {
  const { data: me } = useMe();

  if (!me?.roles?.includes(SUPPORT_ROLE)) {
    return (
      <main className="p-6" data-testid="support-restricted">
        <h1 className="font-heading text-xl font-semibold">Access restricted</h1>
        <p className="text-fg-muted">This area requires the {SUPPORT_ROLE} role.</p>
        <p className="mt-4">
          <Link href="/" className="text-accent underline" data-testid="support-login-link">
            Switch account
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="p-6" data-testid="support-shell">
      <h1 className="font-heading text-xl font-semibold">Support</h1>
      <p className="text-fg-muted">Look up a tenant to begin support.</p>
      <TenantLookup />
    </main>
  );
}

export default function SupportPage() {
  return (
    <div className="min-h-screen text-fg">
      <AppShellHeader />
      <AuthenticationGuard>
        <SupportPageContent />
      </AuthenticationGuard>
    </div>
  );
}
