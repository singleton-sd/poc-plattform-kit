'use client';

import Link from 'next/link';
import { AppShellHeader } from '@/components/app-shell-header';
import { useMe } from '@/features/auth/me';
import { TenantSettings } from '@/features/tenant-settings/tenant-settings';

const TENANT_ADMIN_ROLE = 'tenant-admin';

export default function TenantSettingsPage() {
  const { data: me, isLoading, isError } = useMe();

  if (isLoading) {
    return (
      <main className="p-6 text-fg-muted" data-testid="tenant-settings-page-loading">
        Loading…
      </main>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen text-fg">
        <AppShellHeader />
        <main className="p-6" data-testid="tenant-settings-page-error">
          <h1 className="font-heading text-xl font-semibold">Unable to verify access</h1>
          <p className="text-fg-muted">Could not load your session. Try again later.</p>
          <p className="mt-4">
            <Link
              href="/"
              className="text-accent underline"
              data-testid="tenant-settings-page-login-link"
            >
              Sign in
            </Link>
          </p>
        </main>
      </div>
    );
  }

  if (!me?.roles?.includes(TENANT_ADMIN_ROLE)) {
    return (
      <div className="min-h-screen text-fg">
        <AppShellHeader />
        <main className="p-6" data-testid="tenant-settings-page-restricted">
          <h1 className="font-heading text-xl font-semibold">Access restricted</h1>
          <p className="text-fg-muted">This area requires the {TENANT_ADMIN_ROLE} role.</p>
          <p className="mt-4">
            <Link
              href="/"
              className="text-accent underline"
              data-testid="tenant-settings-page-login-link"
            >
              {me ? 'Switch account' : 'Sign in'}
            </Link>
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-fg">
      <AppShellHeader />
      <main data-testid="tenant-settings-page-shell">
        <TenantSettings />
      </main>
    </div>
  );
}
