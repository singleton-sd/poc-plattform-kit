import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TenantWorkspace } from './tenant-workspace';

const tenant = {
  id: 't-1',
  name: 'Acme',
  slug: 'acme',
  settings: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const findAllRefetch = jest.fn();
const findAll = jest.fn();
const findAllRaw = jest.fn();
const createMutate = jest.fn();
const updateMutate = jest.fn();
let createOnSuccess: ((response: unknown) => void) | undefined;
let updateOnSuccess: ((response: unknown) => void) | undefined;

jest.mock('@/lib/api-client', () => ({
  configureApiClient: jest.fn(),
}));

jest.mock('@poc-plattform-kit/api-client', () => ({
  useTenantControllerFindAll: (...args: unknown[]) => {
    findAll(...args);
    return findAllState;
  },
  tenantControllerFindAll: (...args: unknown[]) => findAllRaw(...args),
  useTenantControllerCreate: (options: {
    mutation?: { onSuccess?: (response: unknown) => void };
  }) => {
    createOnSuccess = options?.mutation?.onSuccess;
    return {
      mutate: createMutate,
      reset: jest.fn(),
      isPending: false,
      isError: false,
      error: null,
    };
  },
  useTenantControllerFindOne: () => ({
    data: { data: tenant },
    isFetching: false,
    isError: false,
    refetch: jest.fn(),
  }),
  useTenantControllerUpdate: (options: {
    mutation?: { onSuccess?: (response: unknown) => void };
  }) => {
    updateOnSuccess = options?.mutation?.onSuccess;
    return {
      mutate: updateMutate,
      reset: jest.fn(),
      isPending: false,
      isError: false,
      error: null,
    };
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

let findAllState: {
  data: unknown;
  isLoading: boolean;
  isError: boolean;
  refetch: jest.Mock;
};

function renderWorkspace() {
  return render(<TenantWorkspace />);
}

describe('TenantWorkspace', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    findAllRefetch.mockReset();
    findAll.mockReset();
    findAllRaw.mockReset();
    createMutate.mockReset();
    updateMutate.mockReset();
    findAllState = {
      data: { data: { items: [tenant], nextCursor: null } },
      isLoading: false,
      isError: false,
      refetch: findAllRefetch,
    };
    Object.assign(navigator, { clipboard: { writeText: jest.fn().mockResolvedValue(undefined) } });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the tenant list', () => {
    renderWorkspace();
    expect(screen.getAllByText('Acme').length).toBeGreaterThan(0);
  });

  it('still renders the list against a pre-pagination API returning a bare array', () => {
    findAllState = {
      data: { data: [tenant] },
      isLoading: false,
      isError: false,
      refetch: findAllRefetch,
    };
    renderWorkspace();
    expect(screen.getAllByText('Acme').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('tenant-empty-state')).not.toBeInTheDocument();
  });

  it('shows the empty state with no tenants and no search', () => {
    findAllState = {
      data: { data: { items: [], nextCursor: null } },
      isLoading: false,
      isError: false,
      refetch: findAllRefetch,
    };
    renderWorkspace();
    expect(screen.getByTestId('tenant-empty-state')).toBeInTheDocument();
  });

  it('shows the error state and retries', () => {
    findAllState = { data: undefined, isLoading: false, isError: true, refetch: findAllRefetch };
    renderWorkspace();

    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(findAllRefetch).toHaveBeenCalled();
  });

  it('debounces the search query passed to the list hook', () => {
    renderWorkspace();
    findAll.mockClear();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search tenants' }), {
      target: { value: 'acme' },
    });

    act(() => jest.advanceTimersByTime(300));

    expect(findAll).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'acme', limit: 100 }),
      expect.anything(),
    );
  });

  it('opens the create drawer from the toolbar button', () => {
    renderWorkspace();

    fireEvent.click(screen.getByTestId('tenant-create-open'));

    expect(screen.getByRole('dialog', { name: 'Create tenant' })).toBeInTheDocument();
  });

  it('hides tenant creation when the page permission is restricted', () => {
    render(<TenantWorkspace canCreate={false} />);

    expect(screen.queryByTestId('tenant-create-open')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Create tenant' })).not.toBeInTheDocument();
  });

  it('hides empty-state creation when the page permission is restricted', () => {
    findAllState = {
      data: { data: { items: [], nextCursor: null } },
      isLoading: false,
      isError: false,
      refetch: findAllRefetch,
    };

    render(<TenantWorkspace canCreate={false} />);

    expect(screen.getByText('No tenants available')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create Tenant' })).not.toBeInTheDocument();
  });

  it('opens the details drawer when a tenant row is selected', () => {
    renderWorkspace();

    fireEvent.click(screen.getByRole('button', { name: 'View details for Acme' }));

    expect(screen.getByRole('dialog', { name: 'Tenant details' })).toBeInTheDocument();
  });

  it('on successful create: closes the drawer, refreshes the list, selects the tenant and toasts', async () => {
    createMutate.mockImplementation(() => createOnSuccess?.({ data: tenant }));
    renderWorkspace();

    fireEvent.click(screen.getByTestId('tenant-create-open'));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Acme' } });
    fireEvent.click(screen.getByTestId('tenant-create-submit'));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Create tenant' })).not.toBeInTheDocument();
    });
    expect(findAllRefetch).toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Tenant details' })).toBeInTheDocument();
    expect(screen.getByTestId('tenant-toast')).toHaveTextContent('Acme was created.');
  });

  it('opens the details drawer directly by tenant ID, bypassing the list', () => {
    renderWorkspace();

    fireEvent.click(screen.getByTestId('tenant-open-by-id-toggle'));
    fireEvent.change(screen.getByLabelText('Tenant ID'), { target: { value: 't-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));

    expect(screen.getByRole('dialog', { name: 'Tenant details' })).toBeInTheDocument();
  });

  it('shows a Load more button only when a next page exists', () => {
    renderWorkspace();
    expect(screen.queryByTestId('tenant-load-more')).not.toBeInTheDocument();
  });

  it('loads and appends the next page on Load more', async () => {
    findAllState = {
      data: { data: { items: [tenant], nextCursor: 'cursor-1' } },
      isLoading: false,
      isError: false,
      refetch: findAllRefetch,
    };
    const nextTenant = { ...tenant, id: 't-2', name: 'Globex', slug: 'globex' };
    findAllRaw.mockResolvedValue({ data: { items: [nextTenant], nextCursor: null } });
    renderWorkspace();

    fireEvent.click(screen.getByTestId('tenant-load-more'));

    await waitFor(() => {
      expect(screen.getAllByText('Globex').length).toBeGreaterThan(0);
    });
    expect(findAllRaw).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: 'cursor-1', limit: 100 }),
    );
    expect(screen.getAllByText('Acme').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('tenant-load-more')).not.toBeInTheDocument();
  });

  it('shows an error and keeps the button when Load more fails', async () => {
    findAllState = {
      data: { data: { items: [tenant], nextCursor: 'cursor-1' } },
      isLoading: false,
      isError: false,
      refetch: findAllRefetch,
    };
    findAllRaw.mockRejectedValue(new Error('network error'));
    renderWorkspace();

    fireEvent.click(screen.getByTestId('tenant-load-more'));

    await waitFor(() => {
      expect(screen.getByTestId('tenant-load-more-error')).toBeInTheDocument();
    });
    expect(screen.getByTestId('tenant-load-more')).toBeInTheDocument();
  });

  it('on successful update: refreshes the list and toasts', async () => {
    updateMutate.mockImplementation(() => updateOnSuccess?.({ data: tenant }));
    renderWorkspace();

    fireEvent.click(screen.getByRole('button', { name: 'View details for Acme' }));
    fireEvent.click(screen.getByTestId('tenant-update-submit'));

    await waitFor(() => {
      expect(findAllRefetch).toHaveBeenCalled();
    });
    expect(screen.getByTestId('tenant-toast')).toHaveTextContent('Acme was updated.');
  });
});
