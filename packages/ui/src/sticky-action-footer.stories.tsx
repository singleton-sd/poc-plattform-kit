import type { Meta, StoryObj } from '@storybook/nextjs';
import { StickyActionFooter } from './sticky-action-footer';

const meta = {
  title: 'Components/Sticky Action Footer',
  component: StickyActionFooter,
  args: {
    onBack: () => undefined,
    primaryLabel: 'Continue',
    onPrimary: () => undefined,
  },
  decorators: [
    (Story) => (
      <div className="relative h-48 w-[375px] bg-bg" style={{ transform: 'translate(0)' }}>
        <Story />
      </div>
    ),
  ],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof StickyActionFooter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const PrimaryUnavailable: Story = {
  args: { primaryUnavailableReason: 'Continue when the upload finishes' },
};
export const Mobile: Story = {
  parameters: { chromatic: { viewports: [375] } },
};
