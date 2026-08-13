import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TenantCreateDrawer } from './tenant-create-drawer';

const mutate = jest.fn();
const reset = jest.fn();
let mutationState: {
  isPending: boolean;
  isError: boolean;
  error: unknown;
};

jest.mock('@poc-plattform-kit/api-client', () => ({
  useTenantControllerCreate: () => ({
    mutate,
    reset,
    ...mutationState,
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
        <input
          aria-label="Name"
          value={String(data.name ?? '')}
          onChange={(event) => onChange({ data: { ...data, name: event.target.value } })}
        />
        <input
          aria-label="Slug"
          value={String(data.slug ?? '')}
          onChange={(event) => onChange({ data: { ...data, slug: event.target.value } })}
        />
      </div>
    ),
  };
});

describe('TenantCreateDrawer', () => {
  beforeEach(() => {
    mutate.mockReset();
    reset.mockReset();
    mutationState = { isPending: false, isError: false, error: null };
  });

  it('renders nothing when closed', () => {
    render(<TenantCreateDrawer open={false} onClose={jest.fn()} onCreated={jest.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders a real <form> so Enter-to-submit keeps working for keyboard users', () => {
    render(<TenantCreateDrawer open onClose={jest.fn()} onCreated={jest.fn()} />);

    const form = screen.getByTestId('tenant-create-form');
    expect(form.tagName).toBe('FORM');
    expect(screen.getByTestId('tenant-create-submit')).toHaveAttribute('form', form.id);
  });

  it('submits name and slug through the generated create hook', async () => {
    render(<TenantCreateDrawer open onClose={jest.fn()} onCreated={jest.fn()} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Acme' } });
    fireEvent.change(screen.getByLabelText('Slug'), { target: { value: 'acme' } });
    fireEvent.click(screen.getByTestId('tenant-create-submit'));

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({ data: { name: 'Acme', slug: 'acme' } });
    });
  });

  it('omits a blank slug so the backend generates one', async () => {
    render(<TenantCreateDrawer open onClose={jest.fn()} onCreated={jest.fn()} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Acme' } });
    fireEvent.click(screen.getByTestId('tenant-create-submit'));

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({ data: { name: 'Acme', slug: undefined } });
    });
  });

  it('shows a client validation error and does not submit when name is missing', () => {
    render(<TenantCreateDrawer open onClose={jest.fn()} onCreated={jest.fn()} />);

    expect(screen.getByTestId('tenant-create-submit')).toBeDisabled();
    fireEvent.submit(screen.getByTestId('tenant-create-form'));

    expect(screen.getByTestId('tenant-create-client-error')).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('shows the API error state', () => {
    mutationState = {
      isPending: false,
      isError: true,
      error: { status: 409, data: { message: 'Tenant slug already exists' } },
    };
    render(<TenantCreateDrawer open onClose={jest.fn()} onCreated={jest.fn()} />);

    expect(screen.getByTestId('tenant-create-error')).toHaveTextContent(
      'Tenant slug already exists',
    );
  });

  it('shows the submitting state', () => {
    mutationState = { isPending: true, isError: false, error: null };
    render(<TenantCreateDrawer open onClose={jest.fn()} onCreated={jest.fn()} />);

    expect(screen.getByTestId('tenant-create-submit')).toHaveTextContent('Creating…');
    expect(screen.getByTestId('tenant-create-submit')).toBeDisabled();
  });

  it('cancel closes the drawer', () => {
    const onClose = jest.fn();
    render(<TenantCreateDrawer open onClose={onClose} onCreated={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalled();
  });
});
