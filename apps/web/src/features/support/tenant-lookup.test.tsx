import { render, screen } from '@testing-library/react';
import { TenantLookup } from './tenant-lookup';

jest.mock('@/lib/api-client', () => ({
  configureApiClient: jest.fn(),
}));

jest.mock('@poc-plattform-kit/api-client', () => ({
  useTenantControllerFindOne: () => ({
    data: undefined,
    error: null,
    isError: false,
    isFetching: false,
    refetch: jest.fn(),
  }),
}));

describe('TenantLookup', () => {
  it('marks the tenant id input as required for assistive tech', () => {
    render(<TenantLookup />);
    const input = screen.getByLabelText('Tenant id');
    expect(input).toBeRequired();
    expect(input).toHaveAttribute('aria-required', 'true');
  });
});
