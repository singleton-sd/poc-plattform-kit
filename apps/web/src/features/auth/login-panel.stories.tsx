import type { Meta, StoryObj } from '@storybook/nextjs';
import {
  meSignedOutHandlers,
  meLoadingHandlers,
  meErrorHandlers,
  meSignedInHandlers,
  meSupportAgentHandlers,
} from '@/testing/handlers/auth';
import { HomeAuthGate } from './home-auth-gate';
import { LoginPanel } from './login-panel';

const meta = {
  title: 'Features/Auth/Login & Session',
  component: LoginPanel,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof LoginPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * LoginPanel in signed-out state.
 * Shows the unauthenticated sign-in surface.
 */
export const LoginPanelSignedOut: Story = {
  parameters: { msw: { handlers: { auth: meSignedOutHandlers } } },
  render: () => <LoginPanel />,
};

/**
 * LoginPanel signing-in / sign-in-error Chromatic cases are N/A for this matrix:
 * those states are driven by ephemeral local React state after a click, and
 * deterministic capture would require story-only props or a second visual
 * stack. Covered by Jest in login-panel.test.tsx instead.
 */

/**
 * HomeAuthGate in loading state (via AuthenticationGuard).
 * Shows the shared session verification pending UI.
 * Uses delayed response to allow Chromatic to capture the loading state snapshot.
 */
export const HomeAuthGateLoading: Story = {
  parameters: { msw: { handlers: { auth: meLoadingHandlers } } },
  render: () => <HomeAuthGate />,
};

/**
 * HomeAuthGate in session verification error state (via AuthenticationGuard).
 * Shows the shared error recovery UI with retry button.
 */
export const HomeAuthGateSessionError: Story = {
  parameters: { msw: { handlers: { auth: meErrorHandlers } } },
  render: () => <HomeAuthGate />,
};

/**
 * HomeAuthGate in signed-in state (regular user).
 * Shows the admin console shell after successful authentication.
 * Demonstrates the post-login authenticated state.
 */
export const HomeAuthGateSignedInRegularUser: Story = {
  parameters: { msw: { handlers: { auth: meSignedInHandlers } } },
  render: () => <HomeAuthGate />,
};

/**
 * HomeAuthGate in signed-in state (support-agent role).
 * Demonstrates that support agents also see the admin console.
 * In Wave 2, role-specific UI restrictions would be applied.
 */
export const HomeAuthGateSignedInSupportAgent: Story = {
  parameters: { msw: { handlers: { auth: meSupportAgentHandlers } } },
  render: () => <HomeAuthGate />,
};

/**
 * LoginPanel signing-in / sign-in-error Chromatic stories are intentionally omitted.
 * Those states require mocking `signIn()` (client Entra bootstrap), which is covered
 * by Jest in `login-panel.test.tsx`. Narrow viewport is N/A — global Chromatic is 1280.
 */
