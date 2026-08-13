import type { Meta, StoryObj } from '@storybook/nextjs';
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
};

/** Signed in without support-agent — Access restricted, not LoginPanel. */
export const SignedInMissingRole: Story = {
  parameters: { msw: { handlers: { auth: meSignedInHandlers } } },
};

/** Signed in as support-agent — support shell visible. */
export const SignedInSupportAgent: Story = {
  parameters: { msw: { handlers: { auth: meSupportAgentHandlers } } },
};
