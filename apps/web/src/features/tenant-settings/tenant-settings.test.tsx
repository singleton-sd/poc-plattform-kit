import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TenantSettings } from './tenant-settings';

const tenant = {
  id: 'tenant-42',
  name: 'Acme Corp',
  slug: 'acme',
  settings: { plan: 'pro' },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const refetchFind = jest.fn();
const updateMutate = jest.fn();
const updateReset = jest.fn();
const configureApiClient = jest.fn();
let updateOnSuccess: ((response: unknown) => void) | undefined;

let findState: {
  data: unknown;
  isFetching: boolean;
  isError: boolean;
  error: unknown;
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
  useTenantControllerFindOne: () => ({ ...findState, refetch: refetchFind }),
  useTenantControllerUpdate: (options: {
    mutation?: { onSuccess?: (response: unknown) => void };
  }) => {
    updateOnSuccess = options?.mutation?.onSuccess;
    return { mutate: updateMutate, reset: updateReset, ...updateState };
  },
}));

function renderComponent() {
  return render(<TenantSettings />);
}

function loadTenant() {
  fireEvent.change(screen.getByTestId('tenant-settings-id-input'), {
    target: { value: 'tenant-42' },
  });
  fireEvent.click(screen.getByTestId('tenant-settings-load'));
}

describe('TenantSettings', () => {
  beforeEach(() => {
    refetchFind.mockReset();
    updateMutate.mockReset();
    updateReset.mockReset();
    configureApiClient.mockReset();
    findState = { data: undefined, isFetching: false, isError: false, error: null };
    updateState = { isPending: false, isError: false, error: null };
  });

  it('does not show the edit form before a tenant is loaded', () => {
    renderComponent();
    expect(screen.queryByTestId('tenant-settings-form')).not.toBeInTheDocument();
  });

  it('configures the api client with the entered tenant id and loads it', () => {
    findState = { data: { data: tenant }, isFetching: false, isError: false, error: null };
    renderComponent();

    loadTenant();

    expect(configureApiClient).toHaveBeenCalledWith({ tenantId: 'tenant-42' });
  });

  it('shows the loading state while fetching', () => {
    findState = { data: undefined, isFetching: true, isError: false, error: null };
    renderComponent();

    loadTenant();

    expect(screen.getByTestId('tenant-settings-loading')).toHaveTextContent('Loading tenant…');
  });

  it('shows a not-found state for a 404', () => {
    findState = { data: undefined, isFetching: false, isError: true, error: { status: 404 } };
    renderComponent();

    loadTenant();

    expect(screen.getByTestId('tenant-settings-not-found')).toHaveTextContent(
      'No tenant was found with id tenant-42.',
    );
  });

  it('shows a generic error state for a non-404 failure', () => {
    findState = { data: undefined, isFetching: false, isError: true, error: { status: 500 } };
    renderComponent();

    loadTenant();

    expect(screen.getByTestId('tenant-settings-load-error')).toHaveTextContent(
      'Tenant lookup failed. Try again later.',
    );
  });

  it('populates the form with the loaded tenant', () => {
    findState = { data: { data: tenant }, isFetching: false, isError: false, error: null };
    renderComponent();

    loadTenant();

    expect(screen.getByTestId('tenant-settings-id')).toHaveTextContent('tenant-42');
    expect(screen.getByTestId('tenant-settings-slug')).toHaveTextContent('acme');
    expect(screen.getByTestId('tenant-settings-name')).toHaveValue('Acme Corp');
    expect(screen.getByTestId('tenant-settings-json')).toHaveValue(
      JSON.stringify({ plan: 'pro' }, null, 2),
    );
  });

  it('saves the edited name and settings', async () => {
    findState = { data: { data: tenant }, isFetching: false, isError: false, error: null };
    renderComponent();
    loadTenant();

    fireEvent.change(screen.getByTestId('tenant-settings-name'), {
      target: { value: 'Acme Corporation' },
    });
    fireEvent.change(screen.getByTestId('tenant-settings-json'), {
      target: { value: '{"plan": "enterprise"}' },
    });
    fireEvent.click(screen.getByTestId('tenant-settings-save'));

    await waitFor(() => {
      expect(updateMutate).toHaveBeenCalledWith({
        id: 'tenant-42',
        data: { name: 'Acme Corporation', settings: { plan: 'enterprise' } },
      });
    });
  });

  it('omits settings from the payload when the settings field is left blank', async () => {
    findState = { data: { data: tenant }, isFetching: false, isError: false, error: null };
    renderComponent();
    loadTenant();

    fireEvent.change(screen.getByTestId('tenant-settings-json'), { target: { value: '   ' } });
    fireEvent.click(screen.getByTestId('tenant-settings-save'));

    await waitFor(() => {
      expect(updateMutate).toHaveBeenCalledWith({
        id: 'tenant-42',
        data: { name: 'Acme Corp' },
      });
    });
  });

  it('shows a client error and does not submit for invalid settings JSON', () => {
    findState = { data: { data: tenant }, isFetching: false, isError: false, error: null };
    renderComponent();
    loadTenant();

    fireEvent.change(screen.getByTestId('tenant-settings-json'), {
      target: { value: '{not-json' },
    });
    fireEvent.click(screen.getByTestId('tenant-settings-save'));

    expect(screen.getByTestId('tenant-settings-client-error')).toHaveTextContent(
      'Settings must be valid JSON',
    );
    expect(updateMutate).not.toHaveBeenCalled();
  });

  it('shows a client error and does not submit for a blank name', () => {
    findState = { data: { data: tenant }, isFetching: false, isError: false, error: null };
    renderComponent();
    loadTenant();

    fireEvent.change(screen.getByTestId('tenant-settings-name'), { target: { value: '  ' } });
    fireEvent.click(screen.getByTestId('tenant-settings-save'));

    expect(screen.getByTestId('tenant-settings-client-error')).toHaveTextContent(
      'Name is required',
    );
    expect(updateMutate).not.toHaveBeenCalled();
  });

  it('shows the API error state on save failure', () => {
    findState = { data: { data: tenant }, isFetching: false, isError: false, error: null };
    updateState = {
      isPending: false,
      isError: true,
      error: { status: 500, data: { message: 'Update failed' } },
    };
    renderComponent();
    loadTenant();

    expect(screen.getByTestId('tenant-settings-save-error')).toHaveTextContent('Update failed');
  });

  it('shows a success toast and refreshes on save success', () => {
    findState = { data: { data: tenant }, isFetching: false, isError: false, error: null };
    updateMutate.mockImplementation(() =>
      updateOnSuccess?.({ data: { ...tenant, name: 'Acme Corporation' } }),
    );
    renderComponent();
    loadTenant();

    fireEvent.click(screen.getByTestId('tenant-settings-save'));

    expect(screen.getByTestId('tenant-settings-toast')).toHaveTextContent(
      'Acme Corporation was updated.',
    );
  });

  it('refetches when loading the same tenant id again', () => {
    findState = { data: { data: tenant }, isFetching: false, isError: false, error: null };
    renderComponent();
    loadTenant();

    refetchFind.mockClear();
    loadTenant();

    expect(refetchFind).toHaveBeenCalled();
  });
});
