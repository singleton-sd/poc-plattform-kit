import { fireEvent, render, screen } from '@testing-library/react';
import { TenantSearch } from './tenant-search';

describe('TenantSearch', () => {
  it('calls onChange as the user types', () => {
    const onChange = jest.fn();
    render(<TenantSearch value="" onChange={onChange} />);

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search tenants' }), {
      target: { value: 'acme' },
    });

    expect(onChange).toHaveBeenCalledWith('acme');
  });

  it('does not render a clear button when empty', () => {
    render(<TenantSearch value="" onChange={jest.fn()} />);
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument();
  });

  it('clears the search value when the clear button is clicked', () => {
    const onChange = jest.fn();
    render(<TenantSearch value="acme" onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(onChange).toHaveBeenCalledWith('');
  });
});
