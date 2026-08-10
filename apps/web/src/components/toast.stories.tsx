import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, userEvent, within } from 'storybook/test';
import { useState } from 'react';
import { Toast } from './toast';

function ToastHarness({
  initialMessage,
  duration = 60_000,
}: {
  initialMessage: string | null;
  duration?: number;
}) {
  const [message, setMessage] = useState(initialMessage);
  return (
    <div className="relative min-h-40 w-full max-w-md bg-bg p-6">
      <button
        type="button"
        className="rounded border border-fg-subtle px-3 py-1.5 text-sm text-fg"
        onClick={() => setMessage('Tenant Example North was created.')}
      >
        Show toast
      </button>
      <Toast
        message={message}
        duration={duration}
        onDismiss={() => setMessage(null)}
        testId="story-toast"
      />
    </div>
  );
}

const meta = {
  title: 'Components/Toast',
  component: ToastHarness,
  parameters: {
    layout: 'padded',
  },
  args: {
    initialMessage: 'Tenant Example North was created.',
    duration: 60_000,
  },
} satisfies Meta<typeof ToastHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Visible: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('story-toast')).toHaveTextContent(
      'Tenant Example North was created.',
    );
  },
};

export const Dismissible: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Dismiss notification' }));
    await expect(canvas.getByTestId('story-toast')).toBeEmptyDOMElement();
  },
};

export const Hidden: Story = {
  args: {
    initialMessage: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('story-toast')).toBeEmptyDOMElement();
  },
};
