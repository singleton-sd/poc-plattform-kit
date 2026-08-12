import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, within } from 'storybook/test';
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
  component: AuthenticationGuard,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof AuthenticationGuard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Session verification pending — chrome stays mounted, protected body hidden. */
export const Loading: Story = {
  parameters: { msw: { handlers: { auth: meLoadingHandlers } } },
  render: () => (
    <GuardWithChrome>
      <ProtectedStub />
    </GuardWithChrome>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('app-shell-header')).toBeInTheDocument();
    await expect(canvas.getByTestId('auth-guard-loading')).toBeInTheDocument();
    await expect(canvas.queryByTestId('auth-guard-protected-stub')).not.toBeInTheDocument();
  },
};

/** Session verification error with retry — distinct from signed-out login. */
export const SessionError: Story = {
  parameters: { msw: { handlers: { auth: meErrorHandlers } } },
  render: () => (
    <GuardWithChrome>
      <ProtectedStub />
    </GuardWithChrome>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('auth-guard-error')).toBeInTheDocument();
    await expect(canvas.getByTestId('auth-guard-retry')).toBeInTheDocument();
    await expect(canvas.queryByTestId('login-sign-in')).not.toBeInTheDocument();
  },
};

/** Signed out — LoginPanel on the current route under app chrome. */
export const SignedOutLogin: Story = {
  parameters: { msw: { handlers: { auth: meSignedOutHandlers } } },
  render: () => (
    <GuardWithChrome>
      <ProtectedStub />
    </GuardWithChrome>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('app-shell-header')).toBeInTheDocument();
    await expect(canvas.getByTestId('login-sign-in')).toBeInTheDocument();
    await expect(canvas.queryByTestId('auth-guard-protected-stub')).not.toBeInTheDocument();
  },
};

/** Signed in — protected children visible. */
export const SignedInAuthorized: Story = {
  parameters: { msw: { handlers: { auth: meSignedInHandlers } } },
  render: () => (
    <GuardWithChrome>
      <ProtectedStub />
    </GuardWithChrome>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByTestId('auth-guard-protected-stub')).toBeInTheDocument();
    await expect(canvas.queryByTestId('login-sign-in')).not.toBeInTheDocument();
  },
};
