import { fireEvent, render, screen } from '@testing-library/react';
import { WizardHeader } from './wizard-header';

describe('WizardHeader', () => {
  it('renders logo, title, autosave live region and Save and exit', () => {
    const onSaveAndExit = jest.fn();
    render(
      <WizardHeader
        logo={<span>Logo</span>}
        autosaveStatus="Draft saved · 4:12 pm"
        onSaveAndExit={onSaveAndExit}
      />,
    );
    expect(screen.getByText('Logo')).toBeInTheDocument();
    expect(screen.getByText('Prepare contract')).toBeInTheDocument();
    expect(screen.queryByRole('heading')).toBeNull();
    const status = screen.getByText('Draft saved · 4:12 pm');
    expect(status).toHaveAttribute('aria-live', 'polite');
    const exit = screen.getByRole('button', { name: 'Save and exit' });
    expect(exit.className).toMatch(/min-h-11/);
    expect(exit.className).toMatch(/min-w-11/);
    fireEvent.click(exit);
    expect(onSaveAndExit).toHaveBeenCalled();
  });

  it('keeps autosave failure as text, not colour alone', () => {
    render(
      <WizardHeader
        logo={<span>Logo</span>}
        autosaveStatus="Couldn't save — retrying"
        onSaveAndExit={jest.fn()}
      />,
    );
    expect(screen.getByText("Couldn't save — retrying")).toHaveAttribute('aria-live', 'polite');
  });
});
