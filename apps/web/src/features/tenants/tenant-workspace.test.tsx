import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TenantWorkspace } from './tenant-workspace';

const mutateCreate = jest.fn();
const mutateUpdate = jest.fn();
const configureApiClient = jest.fn();

jest.mock('@/lib/api-client', () => ({
  configureApiClient: (...args: unknown[]) => configureApiClient(...args),
}));

jest.mock('@poc-plattform-kit/api-client', () => ({
  useTenantControllerCreate: () => ({
    mutate: mutateCreate,
    isPending: false,
    isError: false,
    data: undefined,
  }),
  useTenantControllerUpdate: () => ({
    mutate: mutateUpdate,
    isPending: false,
    isError: false,
    data: undefined,
  }),
  useTenantControllerFindOne: () => ({
    data: undefined,
    isFetching: false,
    isError: false,
  }),
}));

function renderWorkspace() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <TenantWorkspace />
    </QueryClientProvider>,
  );
}

describe('TenantWorkspace', () => {
  beforeEach(() => {
    mutateCreate.mockReset();
    mutateUpdate.mockReset();
    configureApiClient.mockReset();
  });

  it('creates a tenant via the generated mutation hook', () => {
    renderWorkspace();

    fireEvent.change(screen.getByTestId('tenant-name'), { target: { value: 'Acme' } });
    fireEvent.change(screen.getByTestId('tenant-slug'), { target: { value: 'acme' } });
    fireEvent.submit(screen.getByTestId('tenant-create-form'));

    expect(mutateCreate).toHaveBeenCalledWith({
      data: { name: 'Acme', slug: 'acme' },
    });
  });

  it('configures x-tenant-id when the tenant id field changes', async () => {
    renderWorkspace();

    fireEvent.change(screen.getByTestId('tenant-id'), { target: { value: 'ten-42' } });

    await waitFor(() => {
      expect(configureApiClient).toHaveBeenCalledWith({ tenantId: 'ten-42' });
    });
  });
});
