import type { Meta, StoryObj } from '@storybook/nextjs';
import { BrandMark } from './brand-mark';

const meta = {
  title: 'Components/Brand Mark',
  component: BrandMark,
  args: {
    size: 'hero',
  },
  parameters: {
    docs: {
      description: {
        component:
          'The application wordmark rendered with the shared Singleton SD semantic tokens.',
      },
    },
  },
} satisfies Meta<typeof BrandMark>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Hero: Story = {};

export const Header: Story = {
  args: {
    size: 'header',
  },
};
