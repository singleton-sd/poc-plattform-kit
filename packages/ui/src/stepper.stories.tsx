import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, within } from 'storybook/test';
import { Stepper, type WizardStep } from './stepper';

const steps: WizardStep[] = [
  { id: 'type', label: 'Type', href: '#type' },
  { id: 'occupants', label: 'Occupants', href: '#occupants' },
  { id: 'docs', label: 'Documents', href: '#docs' },
  { id: 'terms', label: 'Terms' },
  { id: 'review', label: 'Review' },
  { id: 'send', label: 'Send' },
];

const meta = {
  title: 'Components/Stepper',
  component: Stepper,
  args: { steps, currentIndex: 2 },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Stepper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DesktopMixed: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('navigation', { name: 'Contract steps' })).toBeVisible();
  },
};

export const VisitedLinks: Story = {
  args: { currentIndex: 3 },
};

export const Mobile: Story = {
  parameters: { chromatic: { viewports: [375] } },
};
