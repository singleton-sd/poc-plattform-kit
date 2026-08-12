import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, within } from 'storybook/test';
import SupportPage from '@/app/support/page';
import {
  meSignedInHandlers,
  meSignedOutHandlers,
  meSupportAgentHandlers,
} from '@/testing/handlers/auth';

const meta = {
  title: 'Features/Support/Support page auth',
  component: SupportPage,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof SupportPage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Signed out on /support — login stays on route; no support shell. */
export const SignedOut: Story = {
  parameters: { msw: { handlers: { auth: meSignedOutHandlers } } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('app-shell-header')).toBeInTheDocument();
    await expect(canvas.getByTestId('login-sign-in')).toBeInTheDocument();
    await expect(canvas.queryByTestId('support-shell')).not.toBeInTheDocument();
    await expect(canvas.queryByTestId('support-restricted')).not.toBeInTheDocument();
  },
};

/** Signed in without support-agent — Access restricted, not LoginPanel. */
export const SignedInMissingRole: Story = {
  parameters: { msw: { handlers: { auth: meSignedInHandlers } } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByTestId('support-restricted')).toBeInTheDocument();
    await expect(canvas.queryByTestId('login-sign-in')).not.toBeInTheDocument();
    await expect(canvas.queryByTestId('support-shell')).not.toBeInTheDocument();
  },
};

/** Signed in as support-agent — support shell visible. */
export const SignedInSupportAgent: Story = {
  parameters: { msw: { handlers: { auth: meSupportAgentHandlers } } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByTestId('support-shell')).toBeInTheDocument();
    await expect(canvas.queryByTestId('login-sign-in')).not.toBeInTheDocument();
  },
};
