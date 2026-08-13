import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TenantLookup } from './tenant-lookup';

const refetch = jest.fn();
const configureApiClient = jest.fn();
const findOne = jest.fn();

let findState: {
  data: unknown;
  error: unknown;
  isError: boolean;
  isFetching: boolean;
};

jest.mock('@/lib/api-client', () => ({
  configureApiClient: (...args: unknown[]) => configureApiClient(...args),
}));

jest.mock('@poc-plattform-kit/api-client', () => ({
  useTenantControllerFindOne: (...args: unknown[]) => findOne(...args),
}));

const tenant = {
  id: 't-1',
  name: 'Acme',
  slug: 'acme',
  settings: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function idleFindState() {
  return {
    data: undefined,
    error: null,
    isError: false,
    isFetching: false,
  };
}

function submitTenantId(value = 't-1') {
  fireEvent.change(screen.getByLabelText('Tenant id'), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: /look up tenant/i }));
}

beforeEach(() => {
  refetch.mockReset();
  configureApiClient.mockReset();
  findState = idleFindState();
  findOne.mockImplementation((id: string) => {
    if (!id) {
      return { ...idleFindState(), refetch };
    }
    return { ...findState, refetch };
  });
});

describe('TenantLookup', () => {
  it('marks the tenant id input as required for assistive tech', () => {
    render(<TenantLookup />);
    const input = screen.getByLabelText('Tenant id');
    expect(input).toBeRequired();
    expect(input).toHaveAttribute('aria-required', 'true');
  });

  it('keeps submit disabled until a tenant id is entered', () => {
    render(<TenantLookup />);
    expect(screen.getByRole('button', { name: 'Look up tenant' })).toBeDisabled();
  });

  it('configures the api client with the submitted tenant id', () => {
    render(<TenantLookup />);
    submitTenantId(' t-1 ');

    expect(configureApiClient).toHaveBeenCalledWith({ tenantId: 't-1' });
  });

  it('shows the loading state while fetching', () => {
    findState = { data: undefined, error: null, isError: false, isFetching: true };
    render(<TenantLookup />);
    submitTenantId();

    expect(screen.getByRole('status')).toHaveTextContent('Loading tenant…');
    expect(screen.getByRole('button', { name: 'Looking up…' })).toBeDisabled();
  });

  it('shows a 404 alert when the tenant does not exist', async () => {
    findState = {
      data: undefined,
      error: { status: 404 },
      isError: true,
      isFetching: false,
    };
    render(<TenantLookup />);
    submitTenantId();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No tenant was found with id t-1.');
  });

  it('shows a generic alert when lookup fails for another reason', async () => {
    findState = {
      data: undefined,
      error: { status: 500 },
      isError: true,
      isFetching: false,
    };
    render(<TenantLookup />);
    submitTenantId();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Tenant lookup failed. Try again later.');
  });

  it('renders the tenant after a successful lookup', async () => {
    findState = {
      data: { data: tenant },
      error: null,
      isError: false,
      isFetching: false,
    };
    render(<TenantLookup />);
    submitTenantId();

    const result = await screen.findByTestId('support-tenant-result');
    expect(result).toHaveTextContent('Acme');
    expect(result).toHaveTextContent('t-1');
    expect(result).toHaveTextContent('acme');
    expect(configureApiClient).toHaveBeenCalledWith({ tenantId: 't-1' });
  });

  it('refetches when the same tenant id is submitted again', async () => {
    findState = {
      data: { data: tenant },
      error: null,
      isError: false,
      isFetching: false,
    };
    render(<TenantLookup />);
    submitTenantId();

    await screen.findByTestId('support-tenant-result');
    fireEvent.click(screen.getByRole('button', { name: 'Look up tenant' }));

    await waitFor(() => {
      expect(refetch).toHaveBeenCalled();
    });
  });
});
