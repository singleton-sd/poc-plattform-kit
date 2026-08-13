'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppShellHeader } from '@/components/app-shell-header';
import { AuthenticationGuard } from '@/features/auth/authentication-guard';
import { TenantSettings } from '@/features/tenant-settings/tenant-settings';

/**
 * Access gate for this page. `GET /tenants/:id` and `PATCH /tenants/:id`
 * remain the real authority (tenancy-context match, and owner membership
 * or `tenant-admin` for updates -- see `TenantController`); this page only
 * needs authentication before rendering the lookup form. `GET /api/me`
 * doesn't expose memberships, so this intentionally doesn't re-derive
 * per-tenant authorization client-side; callers who aren't entitled get
 * the backend's 403/404 on lookup or save.
 */
function TenantSettingsPageContent() {
  const searchParams = useSearchParams();
  const tenantId = searchParams.get('tenantId') ?? undefined;

  return (
    <main data-testid="tenant-settings-page-shell">
      <TenantSettings initialTenantId={tenantId} />
    </main>
  );
}

export default function TenantSettingsPage() {
  return (
    <div className="min-h-screen text-fg">
      <AppShellHeader />
      <AuthenticationGuard>
        <Suspense
          fallback={
            <main className="p-6 text-fg-muted" data-testid="tenant-settings-page-loading">
              Loading…
            </main>
          }
        >
          <TenantSettingsPageContent />
        </Suspense>
      </AuthenticationGuard>
    </div>
  );
}
