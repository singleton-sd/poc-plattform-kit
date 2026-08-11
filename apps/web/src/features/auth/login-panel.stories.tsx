import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, within } from 'storybook/test';
import {
  meSignedOutHandlers,
  meLoadingHandlers,
  meErrorHandlers,
  meSignedInHandlers,
  meSupportAgentHandlers,
} from '@/testing/handlers/auth';
import { LoginPanel, HomeAuthGate } from './login-panel';

const meta = {
  title: 'Features/Auth/Login & Session',
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * LoginPanel in signed-out state.
 * Shows the unauthenticated sign-in surface.
 */
export const LoginPanelSignedOut: Story = {
  parameters: { msw: { handlers: { auth: meSignedOutHandlers } } },
  render: () => <LoginPanel />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('login-page')).toBeInTheDocument();
    await expect(canvas.getByText(/Sign in to continue/i)).toBeInTheDocument();
    await expect(canvas.getByTestId('login-sign-in')).toBeInTheDocument();
  },
};

/**
 * HomeAuthGate in loading state.
 * Shows the session verification pending UI.
 * Stays on this story indefinitely because meLoadingHandlers delays forever.
 */
export const HomeAuthGateLoading: Story = {
  parameters: { msw: { handlers: { auth: meLoadingHandlers } } },
  render: () => <HomeAuthGate />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('login-loading')).toBeInTheDocument();
    await expect(canvas.getByText(/Loading…/i)).toBeInTheDocument();
  },
};

/**
 * HomeAuthGate in session verification error state.
 * Shows the error recovery UI with retry button.
 */
export const HomeAuthGateSessionError: Story = {
  parameters: { msw: { handlers: { auth: meErrorHandlers } } },
  render: () => <HomeAuthGate />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('login-session-error')).toBeInTheDocument();
    await expect(canvas.getByText(/Could not verify your session/i)).toBeInTheDocument();
    await expect(canvas.getByTestId('login-session-retry')).toBeInTheDocument();
  },
};

/**
 * HomeAuthGate in signed-in state (regular user).
 * Shows the admin console shell after successful authentication.
 * Demonstrates the post-login authenticated state.
 */
export const HomeAuthGateSignedInRegularUser: Story = {
  parameters: { msw: { handlers: { auth: meSignedInHandlers } } },
  render: () => <HomeAuthGate />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('home-shell')).toBeInTheDocument();
    await expect(canvas.getByText(/Admin console/i)).toBeInTheDocument();
    await expect(canvas.getByText(/alice@example.com/i)).toBeInTheDocument();
    await expect(canvas.getByRole('link', { name: /Tenants/i })).toBeInTheDocument();
    await expect(canvas.getByRole('link', { name: /Support/i })).toBeInTheDocument();
    await expect(canvas.getByTestId('login-sign-out')).toBeInTheDocument();
  },
};

/**
 * HomeAuthGate in signed-in state (support-agent role).
 * Demonstrates that support agents also see the admin console.
 * In Wave 2, role-specific UI restrictions would be applied.
 */
export const HomeAuthGateSignedInSupportAgent: Story = {
  parameters: { msw: { handlers: { auth: meSupportAgentHandlers } } },
  render: () => <HomeAuthGate />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('home-shell')).toBeInTheDocument();
    await expect(canvas.getByText(/bob.support@example.com/i)).toBeInTheDocument();
  },
};
