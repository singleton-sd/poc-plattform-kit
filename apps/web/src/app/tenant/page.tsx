'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppShellHeader } from '@/components/app-shell-header';
import { useMe } from '@/features/auth/me';
import { TenantSettings } from '@/features/tenant-settings/tenant-settings';

/**
 * Access gate for this page. `GET /tenants/:id` and `PATCH /tenants/:id`
 * remain the real authority (tenancy-context match, and `tenant-admin` role
 * for updates -- see `TenantController`); this page only needs to know
 * "is this a signed-in user at all" before rendering the lookup form,
 * because a self-service owner (a `TenantMembership` row, not the Entra
 * `tenant-admin` role -- see ClickUp 86d3zetkw) has no client-side signal
 * for "I own a tenant" today. `GET /api/me` doesn't expose memberships, so
 * this intentionally doesn't try to re-derive per-tenant authorization
 * client-side; any authenticated user reaching this page who isn't
 * actually entitled to the tenant they look up simply gets the backend's
 * existing 403/404 surfaced through the lookup form's error state.
 */
function TenantSettingsPageContent() {
  const { data: me, isLoading, isError } = useMe();
  const searchParams = useSearchParams();
  const tenantId = searchParams.get('tenantId') ?? undefined;

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

  if (!me) {
    return (
      <div className="min-h-screen text-fg">
        <AppShellHeader />
        <main className="p-6" data-testid="tenant-settings-page-restricted">
          <h1 className="font-heading text-xl font-semibold">Access restricted</h1>
          <p className="text-fg-muted">Sign in to manage a tenant.</p>
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

  return (
    <div className="min-h-screen text-fg">
      <AppShellHeader />
      <main data-testid="tenant-settings-page-shell">
        <TenantSettings initialTenantId={tenantId} />
      </main>
    </div>
  );
}

export default function TenantSettingsPage() {
  return (
    <Suspense
      fallback={
        <main className="p-6 text-fg-muted" data-testid="tenant-settings-page-loading">
          Loading…
        </main>
      }
    >
      <TenantSettingsPageContent />
    </Suspense>
  );
}
