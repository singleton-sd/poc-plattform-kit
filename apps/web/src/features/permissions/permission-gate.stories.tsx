import type { Meta, StoryObj } from '@storybook/nextjs';
import type { RequestHandler } from 'msw';
import { expect, userEvent, within } from 'storybook/test';
import { CREATE_ACCESS_REQUEST_400_MESSAGE } from '@/testing/fixtures/permissions';
import { meSignedInHandlers } from '@/testing/handlers/auth';
import {
  permissionsAllowedHandlers,
  permissionsApprovingHandlers,
  permissionsCheckErrorHandlers,
  permissionsCheckLoadingHandlers,
  permissionsCreate400Handlers,
  permissionsDeniedEmptyHandlers,
  permissionsLastDeniedHandlers,
  permissionsPendingHandlers,
} from '@/testing/handlers/permissions';
import { PermissionGate } from './permission-gate';

const TOOLTIP = 'Request your admin/manager to perform this action';

function renderGate() {
  return (
    <div className="flex min-h-48 items-center justify-center p-16">
      <PermissionGate action="update" resource="tenant:t1" tenantId="t1">
        <button type="button">Save Changes</button>
      </PermissionGate>
    </div>
  );
}

function permissionHandlers(permissions: readonly RequestHandler[]) {
  return { msw: { handlers: { auth: meSignedInHandlers, permissions } } };
}

const meta = {
  title: 'Features/Permissions/PermissionGate',
  component: PermissionGate,
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof PermissionGate>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Infinite delay on Check keeps the gate on "Checking access…". */
export const Loading: Story = {
  parameters: permissionHandlers(permissionsCheckLoadingHandlers),
  render: renderGate,
};

/** Check allowed: children only, Save enabled. */
export const Allowed: Story = {
  parameters: permissionHandlers(permissionsAllowedHandlers),
  render: renderGate,
};

/** Denied with no prior request: disabled control + Request access CTA. */
export const Denied: Story = {
  parameters: permissionHandlers(permissionsDeniedEmptyHandlers),
  render: renderGate,
};

/** Denied tooltip via focus (group-focus-within) so Chromatic captures the copy. */
export const DeniedTooltip: Story = {
  parameters: permissionHandlers(permissionsDeniedEmptyHandlers),
  render: renderGate,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const gated = await canvas.findByTestId('permission-gate-disabled');
    gated.focus();
    await userEvent.hover(gated);
    await expect(await canvas.findByRole('tooltip', { name: TOOLTIP })).toBeVisible();
  },
};

/** Pending request: status visible, Request access CTA hidden. */
export const Pending: Story = {
  parameters: permissionHandlers(permissionsPendingHandlers),
  render: renderGate,
};

/** Approving request: status visible, Request access CTA hidden. */
export const Approving: Story = {
  parameters: permissionHandlers(permissionsApprovingHandlers),
  render: renderGate,
};

/** Last request denied: status plus Request access CTA. */
export const LastRequestDenied: Story = {
  parameters: permissionHandlers(permissionsLastDeniedHandlers),
  render: renderGate,
};

/** Check 500 Nest body: OpenFGA unavailable + Retry. */
export const CheckError: Story = {
  parameters: permissionHandlers(permissionsCheckErrorHandlers),
  render: renderGate,
};

/** Request Access dialog open on permanent grant (default). */
export const DialogOpen: Story = {
  parameters: permissionHandlers(permissionsDeniedEmptyHandlers),
  render: renderGate,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('permission-gate-request-cta'));
    await expect(await canvas.findByTestId('request-access-dialog')).toBeVisible();
    await expect(canvas.getByRole('radio', { name: 'Permanent' })).toBeChecked();
  },
};

/** Temporary grant shows expiry field; Submit stays disabled until filled. */
export const DialogTemporaryExpiry: Story = {
  parameters: permissionHandlers(permissionsDeniedEmptyHandlers),
  render: renderGate,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('permission-gate-request-cta'));
    await userEvent.click(canvas.getByRole('radio', { name: 'Temporary' }));
    await expect(canvas.getByTestId('request-access-expires')).toBeVisible();
    await expect(canvas.getByTestId('request-access-submit')).toBeDisabled();
  },
};

/** Submit surfaces the Nest 400 message from the create handler. */
export const DialogSubmitError: Story = {
  parameters: permissionHandlers(permissionsCreate400Handlers),
  render: renderGate,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('permission-gate-request-cta'));
    await userEvent.click(canvas.getByTestId('request-access-submit'));
    await expect(await canvas.findByTestId('request-access-error')).toHaveTextContent(
      CREATE_ACCESS_REQUEST_400_MESSAGE,
    );
  },
};
