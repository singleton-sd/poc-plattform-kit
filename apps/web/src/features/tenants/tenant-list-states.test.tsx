import { fireEvent, render, screen } from '@testing-library/react';
import { TenantEmptyState, TenantErrorState, TenantSearchEmptyState } from './tenant-list-states';

describe('TenantEmptyState', () => {
  it('shows the empty copy and triggers create', () => {
    const onCreate = jest.fn();
    render(<TenantEmptyState onCreate={onCreate} />);

    expect(screen.getByText('Create your first tenant')).toBeInTheDocument();
    expect(
      screen.getByText('Tenants represent organisations using your platform.'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /create tenant/i }));
    expect(onCreate).toHaveBeenCalled();
  });
});

describe('TenantSearchEmptyState', () => {
  it('shows the no-results copy and clears the search', () => {
    const onClearSearch = jest.fn();
    render(<TenantSearchEmptyState onClearSearch={onClearSearch} />);

    expect(screen.getByText('No tenants match your search.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(onClearSearch).toHaveBeenCalled();
  });
});

describe('TenantErrorState', () => {
  it('shows the error copy and retries', () => {
    const onRetry = jest.fn();
    render(<TenantErrorState onRetry={onRetry} />);

    expect(screen.getByText('Unable to load tenants')).toBeInTheDocument();
    expect(screen.getByText("We couldn't retrieve the tenant list.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(onRetry).toHaveBeenCalled();
  });
});
