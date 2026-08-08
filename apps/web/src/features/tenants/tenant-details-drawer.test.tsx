import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TenantDetailsDrawer } from './tenant-details-drawer';

const refetch = jest.fn();
const mutate = jest.fn();
const updateReset = jest.fn();
const configureApiClient = jest.fn();

let findState: {
  data: unknown;
  isFetching: boolean;
  isError: boolean;
};
let updateState: {
  isPending: boolean;
  isError: boolean;
  error: unknown;
};

jest.mock('@/lib/api-client', () => ({
  configureApiClient: (...args: unknown[]) => configureApiClient(...args),
}));

jest.mock('@poc-plattform-kit/api-client', () => ({
  useTenantControllerFindOne: () => ({ ...findState, refetch }),
  useTenantControllerUpdate: () => ({ mutate, reset: updateReset, ...updateState }),
}));

jest.mock('@jsonforms/react', () => {
  const actual = jest.requireActual('@jsonforms/react') as typeof import('@jsonforms/react');
  return {
    ...actual,
    JsonForms: ({
      data,
      onChange,
    }: {
      data: Record<string, unknown>;
      onChange: (event: { data: Record<string, unknown> }) => void;
    }) => (
      <div data-testid="jsonforms-stub">
        <input
          aria-label="Name"
          value={String(data.name ?? '')}
          onChange={(event) => onChange({ data: { ...data, name: event.target.value } })}
        />
      </div>
    ),
  };
});

const tenant = {
  id: 't-1',
  name: 'Acme',
  slug: 'acme',
  settings: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => {
  refetch.mockReset();
  mutate.mockReset();
  updateReset.mockReset();
  configureApiClient.mockReset();
  findState = { data: { data: tenant }, isFetching: false, isError: false };
  updateState = { isPending: false, isError: false, error: null };
  Object.assign(navigator, { clipboard: { writeText: jest.fn().mockResolvedValue(undefined) } });
});

describe('TenantDetailsDrawer', () => {
  it('renders nothing when no tenant is selected', () => {
    render(<TenantDetailsDrawer tenantId={null} onClose={jest.fn()} onUpdated={jest.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('configures the api client with the selected tenant id', () => {
    render(<TenantDetailsDrawer tenantId="t-1" onClose={jest.fn()} onUpdated={jest.fn()} />);
    expect(configureApiClient).toHaveBeenCalledWith({ tenantId: 't-1' });
  });

  it('shows the loading state while fetching', () => {
    findState = { data: undefined, isFetching: true, isError: false };
    render(<TenantDetailsDrawer tenantId="t-1" onClose={jest.fn()} onUpdated={jest.fn()} />);
    expect(screen.queryByTestId('tenant-details-slug')).not.toBeInTheDocument();
  });

  it('shows the error state with a retry action', () => {
    findState = { data: undefined, isFetching: false, isError: true };
    render(<TenantDetailsDrawer tenantId="t-1" onClose={jest.fn()} onUpdated={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(refetch).toHaveBeenCalled();
  });

  it('renders read-only slug and tenant id with an editable name', () => {
    render(<TenantDetailsDrawer tenantId="t-1" onClose={jest.fn()} onUpdated={jest.fn()} />);

    expect(screen.getByTestId('tenant-details-slug')).toHaveTextContent('acme');
    expect(screen.getByTestId('tenant-details-id')).toHaveTextContent('t-1');
    expect(screen.getByLabelText('Name')).toHaveValue('Acme');
  });

  it('saves the edited name through the generated update hook', async () => {
    render(<TenantDetailsDrawer tenantId="t-1" onClose={jest.fn()} onUpdated={jest.fn()} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Acme Corp' } });
    fireEvent.click(screen.getByTestId('tenant-update-submit'));

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({ id: 't-1', data: { name: 'Acme Corp' } });
    });
  });

  it('shows the API error state', () => {
    updateState = {
      isPending: false,
      isError: true,
      error: { status: 500, data: { message: 'Update failed' } },
    };
    render(<TenantDetailsDrawer tenantId="t-1" onClose={jest.fn()} onUpdated={jest.fn()} />);

    expect(screen.getByTestId('tenant-update-error')).toHaveTextContent('Update failed');
  });

  it('cancel closes the drawer', () => {
    const onClose = jest.fn();
    render(<TenantDetailsDrawer tenantId="t-1" onClose={onClose} onUpdated={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });
});
