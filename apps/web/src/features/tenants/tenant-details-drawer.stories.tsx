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
 * Chromatic captures `#storybook-root`. `position: fixed` drawers do not give
 * that root a natural size, so a 1280-wide snapshot buries the Save footer in a
 * 420px rail (or clips it). Pin the panel in a 375×100vh frame and ignore the
 * form body so visual diffs are the footer gate.
 */
function TenantDetailsDrawerHarness() {
  return (
    <div className="relative h-screen w-full overflow-hidden bg-bg [&_[data-testid=tenant-details-drawer]]:!absolute [&_[data-testid=tenant-details-drawer]]:inset-0 [&_[data-testid=tenant-details-drawer]>[role=dialog]]:!absolute [&_[data-testid=tenant-details-drawer]>[role=dialog]]:inset-y-0 [&_[data-testid=tenant-details-drawer]>[role=dialog]]:right-0 [&_[data-testid=tenant-details-drawer]>[role=dialog]]:!w-full">
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

async function waitForSaveFooter(
  canvasElement: HTMLElement,
  assert: (canvas: ReturnType<typeof within>) => Promise<void>,
) {
  const canvas = within(canvasElement);
  await assert(canvas);
  canvas.getByTestId('tenant-details-drawer-footer').scrollIntoView({ block: 'end' });
}

const meta = {
  title: 'Features/Tenants/Details drawer Save gate',
  component: TenantDetailsDrawerHarness,
  parameters: {
    layout: 'fullscreen',
    chromatic: {
      viewports: [375],
      cropToViewport: true,
      ignoreSelectors: ['[data-testid="tenant-details-drawer-body"]'],
    },
  },
} satisfies Meta<typeof TenantDetailsDrawerHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Allowed update: footer Save Changes is the real submit control next to Cancel. */
export const AllowedSave: Story = {
  parameters: drawerHandlers(permissionsAllowedHandlers),
  play: async ({ canvasElement }) => {
    await waitForSaveFooter(canvasElement, async (canvas) => {
      const save = await canvas.findByTestId('tenant-update-submit');
      await expect(save).toBeEnabled();
      await expect(canvas.queryByTestId('permission-gate-request-cta')).not.toBeInTheDocument();
      await expect(canvas.queryByTestId('permission-gate-loading')).not.toBeInTheDocument();
    });
  },
};

/** Denied with empty mine: custom deniedControl Save + Request access CTA. */
export const DeniedWithCta: Story = {
  parameters: drawerHandlers(permissionsDeniedEmptyHandlers),
  play: async ({ canvasElement }) => {
    await waitForSaveFooter(canvasElement, async (canvas) => {
      await expect(await canvas.findByTestId('permission-gate-request-cta')).toBeVisible();
      await expect(canvas.getByTestId('tenant-update-submit')).toHaveAttribute(
        'aria-disabled',
        'true',
      );
    });
  },
};

/** Pending access request: footer status only; Request access CTA hidden. */
export const Pending: Story = {
  parameters: drawerHandlers(permissionsPendingHandlers),
  play: async ({ canvasElement }) => {
    await waitForSaveFooter(canvasElement, async (canvas) => {
      await expect(await canvas.findByTestId('permission-gate-status')).toHaveTextContent(
        /pending/i,
      );
      await expect(canvas.queryByTestId('permission-gate-request-cta')).not.toBeInTheDocument();
    });
  },
};

/** Check error: Nest OpenFGA unavailable + Retry in the footer. */
export const CheckError: Story = {
  parameters: drawerHandlers(permissionsCheckErrorHandlers),
  play: async ({ canvasElement }) => {
    await waitForSaveFooter(canvasElement, async (canvas) => {
      await expect(await canvas.findByTestId('permission-gate-retry')).toBeVisible();
      await expect(canvas.getByRole('alert')).toHaveTextContent('OpenFGA unavailable');
    });
  },
};

/** Drawer stays open with Request Access dialog overlayed (play opens it). */
export const RequestDialogOpen: Story = {
  parameters: drawerHandlers(permissionsDeniedEmptyHandlers),
  play: async ({ canvasElement }) => {
    await waitForSaveFooter(canvasElement, async (canvas) => {
      await userEvent.click(await canvas.findByTestId('permission-gate-request-cta'));
      await expect(await canvas.findByTestId('request-access-dialog')).toBeVisible();
      await expect(canvas.getByTestId('tenant-details-drawer')).toBeVisible();
    });
  },
};
