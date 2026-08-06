'use client';

import { TenantWorkspace } from '@/features/tenants/tenant-workspace';

export default function TenantsPage() {
  return (
    <main className="min-h-screen bg-bg text-fg">
      <TenantWorkspace />
    </main>
  );
}
