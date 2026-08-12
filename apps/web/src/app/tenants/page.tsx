'use client';

import { AppShellHeader } from '@/components/app-shell-header';
import { AuthenticationGuard } from '@/features/auth/authentication-guard';
import { TenantWorkspace } from '@/features/tenants/tenant-workspace';

export default function TenantsPage() {
  return (
    <div className="min-h-screen text-fg">
      <AppShellHeader />
      <AuthenticationGuard>
        <main data-testid="tenants-page-shell">
          <TenantWorkspace />
        </main>
      </AuthenticationGuard>
    </div>
  );
}
