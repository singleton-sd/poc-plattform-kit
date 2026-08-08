import { fireEvent, render, screen } from '@testing-library/react';
import { TenantOpenById } from './tenant-open-by-id';

describe('TenantOpenById', () => {
  it('starts collapsed as a link-style toggle', () => {
    render(<TenantOpenById onOpen={jest.fn()} />);
    expect(screen.getByTestId('tenant-open-by-id-toggle')).toBeInTheDocument();
    expect(screen.queryByTestId('tenant-open-by-id-form')).not.toBeInTheDocument();
  });

  it('expands to an id input on toggle', () => {
    render(<TenantOpenById onOpen={jest.fn()} />);
    fireEvent.click(screen.getByTestId('tenant-open-by-id-toggle'));
    expect(screen.getByTestId('tenant-open-by-id-form')).toBeInTheDocument();
  });

  it('opens the given tenant id and collapses back', () => {
    const onOpen = jest.fn();
    render(<TenantOpenById onOpen={onOpen} />);

    fireEvent.click(screen.getByTestId('tenant-open-by-id-toggle'));
    fireEvent.change(screen.getByLabelText('Tenant ID'), { target: { value: 't-42' } });
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));

    expect(onOpen).toHaveBeenCalledWith('t-42');
    expect(screen.queryByTestId('tenant-open-by-id-form')).not.toBeInTheDocument();
  });

  it('does not open with a blank id', () => {
    const onOpen = jest.fn();
    render(<TenantOpenById onOpen={onOpen} />);

    fireEvent.click(screen.getByTestId('tenant-open-by-id-toggle'));
    expect(screen.getByRole('button', { name: 'Open' })).toBeDisabled();
  });

  it('cancels back to the collapsed toggle', () => {
    render(<TenantOpenById onOpen={jest.fn()} />);

    fireEvent.click(screen.getByTestId('tenant-open-by-id-toggle'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel open by tenant ID' }));

    expect(screen.getByTestId('tenant-open-by-id-toggle')).toBeInTheDocument();
  });
});
