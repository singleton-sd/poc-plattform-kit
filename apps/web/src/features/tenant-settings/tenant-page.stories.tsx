import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { AppShellHeader } from '@/components/app-shell-header';
import { AuthenticationGuard } from '@/features/auth/authentication-guard';
import {
  meSignedInHandlers,
  meSignedOutHandlers,
  meTenantAdminHandlers,
} from '@/testing/handlers/auth';

/**
 * Story shell mirrors apps/web/src/app/tenant/page.tsx (header outside guard)
 * without useSearchParams / TenantSettings fetches, so Chromatic stays
 * deterministic for the auth matrix.
 */
function TenantPageAuthShell({ body }: { body: ReactNode }) {
  return (
    <div className="min-h-screen text-fg">
      <AppShellHeader />
      <AuthenticationGuard>{body}</AuthenticationGuard>
    </div>
  );
}

const SettingsShellStub = (
  <main data-testid="tenant-settings-page-shell" className="p-6">
    <h1 className="font-heading text-xl font-semibold">Tenant settings</h1>
    <p className="text-fg-muted">Signed-in settings surface (lookup/edit stub for auth matrix).</p>
  </main>
);

const meta = {
  title: 'Features/Tenant Settings/Tenant page auth',
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

/** Signed out on /tenant — login on current route; settings shell hidden. */
export const SignedOut: Story = {
  parameters: { msw: { handlers: { auth: meSignedOutHandlers } } },
  render: () => <TenantPageAuthShell body={SettingsShellStub} />,
};

/** Signed in (any roles) — settings shell; backend still authorizes tenant ops. */
export const SignedIn: Story = {
  parameters: { msw: { handlers: { auth: meSignedInHandlers } } },
  render: () => <TenantPageAuthShell body={SettingsShellStub} />,
};

/** Representative tenant-admin signed-in state (same shell; role not required client-side). */
export const SignedInTenantAdmin: Story = {
  parameters: { msw: { handlers: { auth: meTenantAdminHandlers } } },
  render: () => <TenantPageAuthShell body={SettingsShellStub} />,
};
