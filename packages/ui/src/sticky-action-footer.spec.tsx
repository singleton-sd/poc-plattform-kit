import { fireEvent, render, screen } from '@testing-library/react';
import { StickyActionFooter } from './sticky-action-footer';

describe('StickyActionFooter', () => {
  it('renders Back and primary with 44px targets', () => {
    const onBack = jest.fn();
    const onPrimary = jest.fn();
    render(<StickyActionFooter onBack={onBack} primaryLabel="Continue" onPrimary={onPrimary} />);
    const back = screen.getByRole('button', { name: 'Back' });
    const primary = screen.getByRole('button', { name: 'Continue' });
    expect(back.className).toMatch(/min-h-11/);
    expect(primary.className).toMatch(/min-w-11/);
    fireEvent.click(back);
    fireEvent.click(primary);
    expect(onBack).toHaveBeenCalled();
    expect(onPrimary).toHaveBeenCalled();
  });

  it('keeps an unavailable primary focusable with a visible reason', () => {
    const onPrimary = jest.fn();
    render(
      <StickyActionFooter
        onBack={jest.fn()}
        primaryLabel="Continue"
        onPrimary={onPrimary}
        primaryUnavailableReason="Continue when the upload finishes"
      />,
    );
    const primary = screen.getByRole('button', { name: 'Continue' });
    const reason = screen.getByText('Continue when the upload finishes');
    expect(primary).toHaveAttribute('aria-disabled', 'true');
    expect(primary).not.toHaveAttribute('disabled');
    expect(primary).toHaveAttribute('aria-describedby', reason.id);
    fireEvent.click(primary);
    expect(onPrimary).not.toHaveBeenCalled();
    primary.focus();
    expect(primary).toHaveFocus();
  });
});
