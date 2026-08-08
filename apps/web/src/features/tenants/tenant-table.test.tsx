import { act, fireEvent, render, screen } from '@testing-library/react';
import type { TenantResponseDto } from '@poc-plattform-kit/api-client';
import { TenantTable } from './tenant-table';

const tenants: TenantResponseDto[] = [
  {
    id: 't-1',
    name: 'Acme',
    slug: 'acme',
    settings: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  },
  {
    id: 't-2',
    name: 'Globex',
    slug: 'globex',
    settings: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  },
];

beforeEach(() => {
  Object.assign(navigator, { clipboard: { writeText: jest.fn().mockResolvedValue(undefined) } });
});

describe('TenantTable', () => {
  it('renders skeleton rows while loading', () => {
    render(<TenantTable tenants={[]} loading onSelect={jest.fn()} />);
    expect(screen.queryAllByTestId('tenant-row')).toHaveLength(0);
  });

  it('renders a row per tenant with name, slug and id', () => {
    render(<TenantTable tenants={tenants} onSelect={jest.fn()} />);

    expect(screen.getAllByTestId('tenant-row')).toHaveLength(2);
    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.getByText('acme')).toBeInTheDocument();
    expect(screen.getByText('t-1')).toBeInTheDocument();
  });

  it('selects a tenant when its row is activated', () => {
    const onSelect = jest.fn();
    render(<TenantTable tenants={tenants} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: 'View details for Acme' }));

    expect(onSelect).toHaveBeenCalledWith('t-1');
  });

  it('keeps the copy action independent of row selection', async () => {
    const onSelect = jest.fn();
    render(<TenantTable tenants={tenants} onSelect={onSelect} />);

    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Copy tenant ID' })[0]);
    });

    expect(onSelect).not.toHaveBeenCalled();
  });
});
