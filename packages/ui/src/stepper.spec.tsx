import { render, screen } from '@testing-library/react';
import { Stepper, type WizardStep } from './stepper';

const steps: WizardStep[] = [
  { id: 'type', label: 'Type', href: '/type' },
  { id: 'occupants', label: 'Occupants', href: '/occupants' },
  { id: 'terms', label: 'Terms' },
  { id: 'review', label: 'Review' },
  { id: 'docs', label: 'Documents' },
  { id: 'send', label: 'Send' },
];

describe('Stepper', () => {
  it('exposes an ordered contract-steps nav with the current step marked', () => {
    render(<Stepper steps={steps} currentIndex={2} />);
    const nav = screen.getByRole('navigation', { name: 'Contract steps' });
    expect(nav.querySelector('ol')).not.toBeNull();
    expect(screen.getByText('Terms').closest('[aria-current="step"]')).not.toBeNull();
  });

  it('states each step in text and only visited steps with href are links', () => {
    render(<Stepper steps={steps} currentIndex={2} />);
    expect(screen.getAllByText('completed')).toHaveLength(2);
    expect(screen.getAllByText('current')).toHaveLength(1);
    expect(screen.getAllByText('not started')).toHaveLength(3);
    expect(screen.getByRole('link', { name: /Type/ })).toHaveAttribute('href', '/type');
    expect(screen.queryByRole('link', { name: /Terms/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /Review/ })).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows mobile step copy as text and hides the decorative bar from AT', () => {
    render(<Stepper steps={steps} currentIndex={2} />);
    expect(screen.getByText('Step 3 of 6 · Terms')).toBeInTheDocument();
    expect(screen.getByTestId('step-progress')).toHaveAttribute('aria-hidden', 'true');
  });

  it('uses foreground token classes for ticks, connectors and dots', () => {
    const { container } = render(<Stepper steps={steps} currentIndex={2} />);
    expect(container.querySelector('svg.text-fg')).not.toBeNull();
    expect(screen.getAllByTestId('step-connector')[0]).toHaveClass('bg-fg');
    expect(container.querySelector('.border-fg')).not.toBeNull();
    expect(container.querySelector('.bg-fg')).not.toBeNull();
  });
});
