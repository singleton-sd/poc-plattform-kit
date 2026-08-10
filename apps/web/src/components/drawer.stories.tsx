import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Drawer } from './drawer';

const meta = {
  title: 'Components/Drawer',
  component: Drawer,
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    open: true,
    title: 'Create tenant',
    titleId: 'story-drawer-title',
    testId: 'story-drawer',
    onClose: fn(),
    children: (
      <p className="text-sm text-fg-muted">
        Deterministic drawer body used to prove the shared shell layout.
      </p>
    ),
    footer: (
      <button type="button" className="rounded bg-accent px-4 py-2 text-sm text-accent-on">
        Save
      </button>
    ),
  },
} satisfies Meta<typeof Drawer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OpenDesktop: Story = {
  parameters: {
    chromatic: { viewports: [1280] },
  },
};

/** Narrow viewport exposes the mobile Back control instead of the desktop Close control. */
export const OpenNarrow: Story = {
  parameters: {
    chromatic: { viewports: [375] },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Chromatic captures 375px; local play still runs at the Storybook canvas width.
    await expect(canvas.getByRole('dialog', { name: 'Create tenant' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  },
};

export const EscapeCloses: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('dialog', { name: 'Create tenant' })).toBeVisible();
    await userEvent.keyboard('{Escape}');
    await expect(args.onClose).toHaveBeenCalled();
  },
};
