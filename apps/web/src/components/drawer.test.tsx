import { fireEvent, render, screen } from '@testing-library/react';
import { Drawer } from './drawer';

describe('Drawer', () => {
  it('renders nothing when closed', () => {
    render(
      <Drawer open={false} title="Tenant" onClose={jest.fn()}>
        content
      </Drawer>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders as a labelled dialog when open', () => {
    render(
      <Drawer open title="Tenant details" onClose={jest.fn()}>
        content
      </Drawer>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAccessibleName('Tenant details');
  });

  it('calls onClose on Escape', () => {
    const onClose = jest.fn();
    render(
      <Drawer open title="Tenant" onClose={onClose}>
        content
      </Drawer>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = jest.fn();
    render(
      <Drawer open title="Tenant" onClose={onClose}>
        content
      </Drawer>,
    );
    fireEvent.click(screen.getByTestId('drawer-backdrop'));
    expect(onClose).toHaveBeenCalled();
  });

  it('moves focus into the panel on open', () => {
    render(
      <Drawer open title="Tenant" onClose={jest.fn()}>
        <button type="button">First</button>
      </Drawer>,
    );
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
  });
});
