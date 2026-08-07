'use client';

import { AppShellHeader } from '@/components/app-shell-header';
import { TenantWorkspace } from '@/features/tenants/tenant-workspace';

export default function TenantsPage() {
  return (
    <div className="min-h-screen text-fg">
      <AppShellHeader />
      <main>
        <TenantWorkspace />
      </main>
    </div>
  );
}
