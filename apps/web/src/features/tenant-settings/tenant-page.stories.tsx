import type { Meta, StoryObj } from '@storybook/nextjs';
import TenantSettingsPage from '@/app/tenant/page';
import {
  meSignedInHandlers,
  meSignedOutHandlers,
  meTenantAdminHandlers,
} from '@/testing/handlers/auth';

const meta = {
  title: 'Features/Tenant Settings/Tenant page auth',
  component: TenantSettingsPage,
  parameters: {
    layout: 'fullscreen',
    nextjs: {
      navigation: {
        query: {},
      },
    },
  },
} satisfies Meta<typeof TenantSettingsPage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Signed out on /tenant — login on current route; settings shell hidden. */
export const SignedOut: Story = {
  parameters: { msw: { handlers: { auth: meSignedOutHandlers } } },
};

/** Signed in (any roles) — settings shell; backend still authorizes tenant ops. */
export const SignedIn: Story = {
  parameters: {
    msw: { handlers: { auth: meSignedInHandlers } },
  },
};

/** Representative tenant-admin signed-in state (same shell; role not required client-side). */
export const SignedInTenantAdmin: Story = {
  parameters: {
    msw: { handlers: { auth: meTenantAdminHandlers } },
  },
};
