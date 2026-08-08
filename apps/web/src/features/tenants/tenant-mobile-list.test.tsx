import { fireEvent, render, screen } from '@testing-library/react';
import type { TenantResponseDto } from '@poc-plattform-kit/api-client';
import { TenantMobileList } from './tenant-mobile-list';

const tenants: TenantResponseDto[] = [
  {
    id: 't-1',
    name: 'Acme',
    slug: 'acme',
    settings: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  },
];

describe('TenantMobileList', () => {
  it('renders skeleton rows while loading', () => {
    render(<TenantMobileList tenants={[]} loading onSelect={jest.fn()} />);
    expect(screen.queryAllByTestId('tenant-mobile-row')).toHaveLength(0);
  });

  it('renders name and slug for each tenant', () => {
    render(<TenantMobileList tenants={tenants} onSelect={jest.fn()} />);
    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.getByText('acme')).toBeInTheDocument();
  });

  it('selects a tenant when its row is tapped', () => {
    const onSelect = jest.fn();
    render(<TenantMobileList tenants={tenants} onSelect={onSelect} />);

    fireEvent.click(screen.getByTestId('tenant-mobile-row'));

    expect(onSelect).toHaveBeenCalledWith('t-1');
  });
});
