import { act, fireEvent, render, screen } from '@testing-library/react';
import { Toast } from './toast';

describe('Toast', () => {
  it('renders nothing when message is null', () => {
    render(<Toast message={null} onDismiss={jest.fn()} />);
    expect(screen.queryByRole('status')).toBeEmptyDOMElement();
  });

  it('announces the message via a polite live region', () => {
    render(<Toast message="Tenant created" onDismiss={jest.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('Tenant created');
  });

  it('dismisses on click', () => {
    const onDismiss = jest.fn();
    render(<Toast message="Tenant created" onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it('auto-dismisses after the given duration', () => {
    jest.useFakeTimers();
    const onDismiss = jest.fn();
    render(<Toast message="Tenant created" onDismiss={onDismiss} duration={1000} />);

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(onDismiss).toHaveBeenCalled();
    jest.useRealTimers();
  });
});
