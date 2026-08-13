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

  it('marks the tenant id lookup input as required for assistive tech', () => {
    renderComponent();
    const input = screen.getByTestId('tenant-settings-id-input');
    expect(input).toBeRequired();
    expect(input).toHaveAttribute('aria-required', 'true');
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

  it('hides the stale form when a failed refetch still returns cached tenant data', () => {
    // TanStack Query keeps the previous `data` around while `isError` is true
    // on a refetch failure — the form must not render alongside the error.
    findState = {
      data: { data: tenant },
      isFetching: false,
      isError: true,
      error: { status: 500 },
    };
    renderComponent();
    loadTenant();

    expect(screen.queryByTestId('tenant-settings-form')).not.toBeInTheDocument();
    expect(screen.getByTestId('tenant-settings-load-error')).toBeInTheDocument();
  });

  it('populates the form with the loaded tenant', () => {
    findState = { data: { data: tenant }, isFetching: false, isError: false, error: null };
    renderComponent();

    loadTenant();

    expect(screen.getByTestId('tenant-settings-id')).toHaveTextContent('tenant-42');
    expect(screen.getByTestId('tenant-settings-slug')).toHaveTextContent('acme');
    expect(screen.getByLabelText('Name')).toHaveValue('Acme Corp');
    expect(screen.getByTestId('tenant-settings-json')).toHaveValue(
      JSON.stringify({ plan: 'pro' }, null, 2),
    );
  });

  it('saves the edited name and settings', async () => {
    findState = { data: { data: tenant }, isFetching: false, isError: false, error: null };
    renderComponent();
    loadTenant();

    fireEvent.change(screen.getByLabelText('Name'), {
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

    expect(screen.getByTestId('tenant-settings-json-error')).toHaveTextContent(
      'Settings must be valid JSON',
    );
    expect(updateMutate).not.toHaveBeenCalled();
  });

  it('shows an inline JSON error on blur before any submit', () => {
    findState = { data: { data: tenant }, isFetching: false, isError: false, error: null };
    renderComponent();
    loadTenant();

    const textarea = screen.getByTestId('tenant-settings-json');
    fireEvent.change(textarea, { target: { value: '{not-json' } });

    expect(screen.queryByTestId('tenant-settings-json-error')).not.toBeInTheDocument();
    expect(screen.getByTestId('tenant-settings-save')).toBeEnabled();
    expect(updateMutate).not.toHaveBeenCalled();

    fireEvent.blur(textarea);

    const error = screen.getByTestId('tenant-settings-json-error');
    expect(error).toHaveTextContent('Settings must be valid JSON');
    expect(error).toHaveAttribute('role', 'alert');
    expect(textarea).toHaveAttribute('aria-invalid', 'true');
    expect(textarea).toHaveAttribute('aria-describedby', 'tenant-settings-json-error');
    expect(screen.getByTestId('tenant-settings-save')).toBeDisabled();
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

    expect(screen.getByTestId('tenant-update-error')).toHaveTextContent('Update failed');
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

  describe('initialTenantId', () => {
    it('pre-fills the lookup input and configures the api client without a manual submit', () => {
      findState = { data: { data: tenant }, isFetching: false, isError: false, error: null };

      render(<TenantSettings initialTenantId="tenant-42" />);

      expect(screen.getByTestId('tenant-settings-id-input')).toHaveValue('tenant-42');
      expect(configureApiClient).toHaveBeenCalledWith({ tenantId: 'tenant-42' });
      expect(screen.getByTestId('tenant-settings-id')).toHaveTextContent('tenant-42');
    });

    it('does not configure the api client when no initial id is supplied', () => {
      renderComponent();

      expect(configureApiClient).not.toHaveBeenCalled();
    });
  });
});
