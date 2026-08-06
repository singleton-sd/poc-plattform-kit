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
        {'name' in data ? (
          <input
            aria-label="Name"
            value={String(data.name ?? '')}
            onChange={(event) => onChange({ data: { ...data, name: event.target.value } })}
          />
        ) : null}
        {'slug' in data ? (
          <input
            aria-label="Slug"
            value={String(data.slug ?? '')}
            onChange={(event) => onChange({ data: { ...data, slug: event.target.value } })}
          />
        ) : null}
      </div>
    ),
  };
});

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

  it('creates a tenant via Zod + generated mutation hook', async () => {
    renderWorkspace();

    const createForm = screen.getByTestId('tenant-create-form');
    fireEvent.change(createForm.querySelector('[aria-label="Name"]') as HTMLInputElement, {
      target: { value: 'Acme' },
    });
    fireEvent.change(createForm.querySelector('[aria-label="Slug"]') as HTMLInputElement, {
      target: { value: 'acme' },
    });
    fireEvent.click(screen.getByTestId('tenant-create'));

    await waitFor(() => {
      expect(mutateCreate).toHaveBeenCalledWith({
        data: { name: 'Acme', slug: 'acme' },
      });
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
