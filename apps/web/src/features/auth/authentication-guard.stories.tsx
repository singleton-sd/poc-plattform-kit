import type { Meta, StoryObj } from '@storybook/nextjs';
import { AppShellHeader } from '@/components/app-shell-header';
import {
  meErrorHandlers,
  meLoadingHandlers,
  meSignedInHandlers,
  meSignedOutHandlers,
} from '@/testing/handlers/auth';
import { AuthenticationGuard } from './authentication-guard';

function GuardWithChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen text-fg">
      <AppShellHeader />
      <AuthenticationGuard>{children}</AuthenticationGuard>
    </div>
  );
}

const ProtectedStub = () => (
  <main className="p-6" data-testid="auth-guard-protected-stub">
    <h1 className="font-heading text-xl font-semibold">Protected content</h1>
    <p className="text-fg-muted">Visible only when signed in.</p>
  </main>
);

const meta = {
  title: 'Features/Auth/AuthenticationGuard',
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

/** Session verification pending — chrome stays mounted, protected body hidden. */
export const Loading: Story = {
  parameters: { msw: { handlers: { auth: meLoadingHandlers } } },
  render: () => (
    <GuardWithChrome>
      <ProtectedStub />
    </GuardWithChrome>
  ),
};

/** Session verification error with retry — distinct from signed-out login. */
export const SessionError: Story = {
  parameters: { msw: { handlers: { auth: meErrorHandlers } } },
  render: () => (
    <GuardWithChrome>
      <ProtectedStub />
    </GuardWithChrome>
  ),
};

/** Signed out — LoginPanel on the current route under app chrome. */
export const SignedOutLogin: Story = {
  parameters: { msw: { handlers: { auth: meSignedOutHandlers } } },
  render: () => (
    <GuardWithChrome>
      <ProtectedStub />
    </GuardWithChrome>
  ),
};

/** Signed in — protected children visible. */
export const SignedInAuthorized: Story = {
  parameters: { msw: { handlers: { auth: meSignedInHandlers } } },
  render: () => (
    <GuardWithChrome>
      <ProtectedStub />
    </GuardWithChrome>
  ),
};
