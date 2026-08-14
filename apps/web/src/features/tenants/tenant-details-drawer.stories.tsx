import type { Meta, StoryObj } from '@storybook/nextjs';
import type { RequestHandler } from 'msw';
import { expect, userEvent, within } from 'storybook/test';
import { meSignedInHandlers } from '@/testing/handlers/auth';
import {
  permissionsAllowedHandlers,
  permissionsCheckErrorHandlers,
  permissionsDeniedEmptyHandlers,
  permissionsPendingHandlers,
} from '@/testing/handlers/permissions';
import { DETAILS_DRAWER_TENANT_ID, tenantsFindOneHandlers } from '@/testing/handlers/tenants';
import { TenantDetailsDrawer } from './tenant-details-drawer';

/**
 * Chromatic cannot reliably snapshot `position: fixed` drawers (or sticky
 * footers inside them): `#storybook-root` gets no natural size, so the Save
 * gate is clipped or missing. Pin the shell in normal flow. `transform` on the
 * frame contains the Request Access dialog (`position: fixed`) so it paints
 * inside the snapshot instead of overflowing the footer.
 */
const DRAWER_FRAME_STYLES = `
  [data-chromatic-drawer-frame] {
    transform: translate(0);
  }
  [data-chromatic-drawer-frame] [data-testid="tenant-details-drawer"],
  [data-chromatic-drawer-frame] [data-testid="tenant-details-drawer"] > [role="dialog"] {
    position: relative !important;
    inset: auto !important;
    width: 100% !important;
    height: auto !important;
    max-height: none !important;
  }
  [data-chromatic-drawer-frame] [data-testid="drawer-backdrop"] {
    display: none !important;
  }
  [data-chromatic-drawer-frame]:not([data-chromatic-overlay]) [data-testid="tenant-details-drawer-body"] {
    display: none !important;
  }
  [data-chromatic-drawer-frame] [data-testid="tenant-details-drawer-footer"] {
    position: relative !important;
    bottom: auto !important;
  }
`;

function TenantDetailsDrawerHarness({ overlay = false }: { overlay?: boolean }) {
  return (
    <div
      data-chromatic-drawer-frame
      {...(overlay ? { 'data-chromatic-overlay': '' } : {})}
      className={
        overlay
          ? 'relative w-[375px] min-h-[720px] bg-bg'
          : 'relative w-[375px] min-h-[280px] bg-bg'
      }
    >
      <style>{DRAWER_FRAME_STYLES}</style>
      <TenantDetailsDrawer
        tenantId={DETAILS_DRAWER_TENANT_ID}
        onClose={() => undefined}
        onUpdated={() => undefined}
      />
    </div>
  );
}

function drawerHandlers(permissions: readonly RequestHandler[]) {
  return {
    msw: {
      handlers: {
        auth: meSignedInHandlers,
        tenants: tenantsFindOneHandlers,
        permissions,
      },
    },
  };
}

const meta = {
  title: 'Features/Tenants/Details drawer Save gate',
  component: TenantDetailsDrawerHarness,
  parameters: {
    layout: 'fullscreen',
    chromatic: {
      viewports: [375],
      delay: 400,
    },
  },
} satisfies Meta<typeof TenantDetailsDrawerHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Allowed update: footer Save Changes is the real submit control next to Cancel. */
export const AllowedSave: Story = {
  parameters: drawerHandlers(permissionsAllowedHandlers),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const save = await canvas.findByTestId('tenant-update-submit');
    await expect(save).toBeEnabled();
    await expect(canvas.getByTestId('tenant-details-drawer-footer')).toBeVisible();
    await expect(canvas.queryByTestId('permission-gate-request-cta')).not.toBeInTheDocument();
    await expect(canvas.queryByTestId('permission-gate-loading')).not.toBeInTheDocument();
  },
};

/** Denied with empty mine: custom deniedControl Save + Request access CTA. */
export const DeniedWithCta: Story = {
  parameters: drawerHandlers(permissionsDeniedEmptyHandlers),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByTestId('permission-gate-request-cta')).toBeVisible();
    await expect(canvas.getByTestId('tenant-update-submit')).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await expect(canvas.getByTestId('tenant-details-drawer-footer')).toBeVisible();
  },
};

/** Pending access request: footer status only; Request access CTA hidden. */
export const Pending: Story = {
  parameters: drawerHandlers(permissionsPendingHandlers),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByTestId('permission-gate-status')).toHaveTextContent(/pending/i);
    await expect(canvas.queryByTestId('permission-gate-request-cta')).not.toBeInTheDocument();
    await expect(canvas.getByTestId('tenant-details-drawer-footer')).toBeVisible();
  },
};

/** Check error: Nest OpenFGA unavailable + Retry in the footer. */
export const CheckError: Story = {
  parameters: drawerHandlers(permissionsCheckErrorHandlers),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByTestId('permission-gate-retry')).toBeVisible();
    await expect(canvas.getByRole('alert')).toHaveTextContent('OpenFGA unavailable');
    await expect(canvas.getByTestId('tenant-details-drawer-footer')).toBeVisible();
  },
};

/** Drawer stays open with Request Access dialog overlayed (play opens it). */
export const RequestDialogOpen: Story = {
  args: { overlay: true },
  parameters: drawerHandlers(permissionsDeniedEmptyHandlers),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('permission-gate-request-cta'));
    const dialog = await canvas.findByTestId('request-access-dialog');
    await expect(dialog).toBeVisible();
    await expect(canvas.getByRole('heading', { name: 'Request access' })).toBeVisible();
    await expect(canvas.getByTestId('tenant-details-drawer')).toBeVisible();
  },
};
