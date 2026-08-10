import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, userEvent, within } from 'storybook/test';
import { useState } from 'react';
import { Drawer } from './drawer';

function DrawerHarness({ initiallyOpen = true }: { initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <div className="relative min-h-screen bg-bg">
      <p className="p-4 text-sm text-fg-muted" data-testid="drawer-harness-status">
        {open ? 'Drawer open' : 'Drawer closed'}
      </p>
      <Drawer
        open={open}
        title="Create tenant"
        titleId="story-drawer-title"
        testId="story-drawer"
        onClose={() => setOpen(false)}
        footer={
          <button type="button" className="rounded bg-accent px-4 py-2 text-sm text-accent-on">
            Save
          </button>
        }
      >
        <p className="text-sm text-fg-muted">
          Deterministic drawer body used to prove the shared shell layout.
        </p>
      </Drawer>
    </div>
  );
}

const meta = {
  title: 'Components/Drawer',
  component: DrawerHarness,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof DrawerHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OpenDesktop: Story = {
  parameters: {
    chromatic: { viewports: [1280] },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('dialog', { name: 'Create tenant' })).toBeVisible();
  },
};

/** Narrow Chromatic viewport (375) exposes the mobile Back control. */
export const OpenNarrow: Story = {
  parameters: {
    chromatic: { viewports: [375] },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('dialog', { name: 'Create tenant' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Back' })).toBeVisible();
  },
};

export const EscapeCloses: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('dialog', { name: 'Create tenant' })).toBeVisible();
    await userEvent.keyboard('{Escape}');
    await expect(canvas.getByTestId('drawer-harness-status')).toHaveTextContent('Drawer closed');
    await expect(canvas.queryByRole('dialog')).not.toBeInTheDocument();
  },
};
