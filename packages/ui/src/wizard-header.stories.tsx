import type { Meta, StoryObj } from '@storybook/nextjs';
import { WizardHeader } from './wizard-header';

const meta = {
  title: 'Components/Wizard Header',
  component: WizardHeader,
  args: {
    logo: <span className="font-heading font-semibold">LM</span>,
    autosaveStatus: 'Saving…',
    onSaveAndExit: () => undefined,
  },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof WizardHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Saving: Story = {};
export const Saved: Story = { args: { autosaveStatus: 'Draft saved · 4:12 pm' } };
export const Failure: Story = { args: { autosaveStatus: "Couldn't save — retrying" } };
