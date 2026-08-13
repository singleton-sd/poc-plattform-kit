import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, userEvent, within } from 'storybook/test';
import {
  CreateProjectForm,
  emptyCreateProjectData,
  populatedCreateProjectData,
} from './create-project-form';

const meta = {
  title: 'Features/Forms Demo/Create project',
  component: CreateProjectForm,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Schema-driven demo form using `@poc-plattform-kit/forms` Tailwind + Singleton SD token renderers (not Material UI).',
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-lg bg-bg p-6 text-fg">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CreateProjectForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    initialData: emptyCreateProjectData,
  },
};

export const ValidationError: Story = {
  args: {
    initialData: emptyCreateProjectData,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByTestId('create-project-validation-error')).not.toBeInTheDocument();
    await expect(canvas.getByTestId('create-project-submit')).toBeDisabled();

    // Primary submit is disabled while invalid; append a temporary enabled
    // submitter so Chromatic can still demo the handler gate + multi-issue summary.
    const form = canvas.getByTestId('create-project-form');
    const tempSubmit = document.createElement('button');
    tempSubmit.type = 'submit';
    tempSubmit.textContent = 'Force submit';
    form.appendChild(tempSubmit);
    await userEvent.click(tempSubmit);
    tempSubmit.remove();

    await expect(await canvas.findByTestId('create-project-validation-error')).toBeVisible();
  },
};

export const PopulatedSubmit: Story = {
  args: {
    initialData: populatedCreateProjectData,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByDisplayValue('Platform Kit Demo')).toBeInTheDocument();
    await userEvent.click(canvas.getByTestId('create-project-submit'));
    await expect(await canvas.findByTestId('create-project-success')).toHaveTextContent(
      'Demo project created. No data was sent to the API.',
    );
  },
};

export const ReadOnly: Story = {
  args: {
    initialData: populatedCreateProjectData,
    readOnly: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('create-project-submit')).toBeDisabled();
    await expect(canvas.getByDisplayValue('Platform Kit Demo')).toBeDisabled();
  },
};
