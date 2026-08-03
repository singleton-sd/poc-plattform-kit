'use client';

import { useMe } from '@/features/auth/me';

const SUPPORT_ROLE = 'support-agent';

export default function SupportPage() {
  const { data: me, isLoading } = useMe();

  if (isLoading) {
    return (
      <main className="p-6 text-fg-muted" data-testid="support-loading">
        Loading…
      </main>
    );
  }

  if (me?.role !== SUPPORT_ROLE) {
    return (
      <main className="p-6" data-testid="support-restricted">
        <h1 className="font-heading text-xl font-semibold text-fg">Access restricted</h1>
        <p className="text-fg-muted">This area requires the {SUPPORT_ROLE} role.</p>
      </main>
    );
  }

  return (
    <main className="p-6" data-testid="support-shell">
      <h1 className="font-heading text-xl font-semibold text-fg">Support</h1>
      <p className="text-fg-muted">Support admin shell -- pillar features land here.</p>
    </main>
  );
}
