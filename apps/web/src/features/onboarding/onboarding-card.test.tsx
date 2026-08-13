import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { OnboardingCard } from './onboarding-card';

const mutate = jest.fn();
let mutationState: {
  isPending: boolean;
  isError: boolean;
  error: unknown;
};

jest.mock('@poc-plattform-kit/api-client', () => ({
  useTenantControllerCreateSelfService: (options: {
    mutation?: { onSuccess?: (response: unknown) => void };
  }) => ({
    mutate: (variables: unknown) => {
      mutate(variables);
      options.mutation?.onSuccess?.({
        data: { id: 't1', name: 'Acme', slug: 'acme' },
      });
    },
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

describe('OnboardingCard', () => {
  beforeEach(() => {
    mutate.mockReset();
    mutationState = { isPending: false, isError: false, error: null };
  });

  it('starts collapsed with a CTA to create a tenant', () => {
    render(<OnboardingCard onCreated={jest.fn()} onDismiss={jest.fn()} />);

    expect(screen.getByTestId('onboarding-card')).toBeInTheDocument();
    expect(screen.getByTestId('onboarding-create-open')).toBeInTheDocument();
    expect(screen.queryByTestId('tenant-create-form')).not.toBeInTheDocument();
  });

  it('expands to the reused create-tenant form on CTA click', () => {
    render(<OnboardingCard onCreated={jest.fn()} onDismiss={jest.fn()} />);

    fireEvent.click(screen.getByTestId('onboarding-create-open'));

    expect(screen.getByTestId('tenant-create-form')).toBeInTheDocument();
    expect(screen.getByTestId('onboarding-create-submit')).toBeInTheDocument();
  });

  it('calls onDismiss when "Not now" is clicked', () => {
    const onDismiss = jest.fn();
    render(<OnboardingCard onCreated={jest.fn()} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByTestId('onboarding-dismiss'));

    expect(onDismiss).toHaveBeenCalled();
  });

  it('submits name and slug through the generated create hook', async () => {
    render(<OnboardingCard onCreated={jest.fn()} onDismiss={jest.fn()} />);

    fireEvent.click(screen.getByTestId('onboarding-create-open'));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Acme' } });
    fireEvent.change(screen.getByLabelText('Slug'), { target: { value: 'acme' } });
    fireEvent.click(screen.getByTestId('onboarding-create-submit'));

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({ data: { name: 'Acme', slug: 'acme' } });
    });
  });

  it('calls onCreated with the tenant returned by the create mutation', async () => {
    const onCreated = jest.fn();
    render(<OnboardingCard onCreated={onCreated} onDismiss={jest.fn()} />);

    fireEvent.click(screen.getByTestId('onboarding-create-open'));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Acme' } });
    fireEvent.click(screen.getByTestId('onboarding-create-submit'));

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith({ id: 't1', name: 'Acme', slug: 'acme' });
    });
  });

  it('shows a client validation error and does not submit when name is missing', () => {
    render(<OnboardingCard onCreated={jest.fn()} onDismiss={jest.fn()} />);

    fireEvent.click(screen.getByTestId('onboarding-create-open'));
    expect(screen.getByTestId('onboarding-create-submit')).toBeDisabled();
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
    render(<OnboardingCard onCreated={jest.fn()} onDismiss={jest.fn()} />);

    fireEvent.click(screen.getByTestId('onboarding-create-open'));

    expect(screen.getByTestId('tenant-create-error')).toHaveTextContent(
      'Tenant slug already exists',
    );
  });

  it('shows the submitting state', () => {
    mutationState = { isPending: true, isError: false, error: null };
    render(<OnboardingCard onCreated={jest.fn()} onDismiss={jest.fn()} />);

    fireEvent.click(screen.getByTestId('onboarding-create-open'));

    expect(screen.getByTestId('onboarding-create-submit')).toHaveTextContent('Creating…');
    expect(screen.getByTestId('onboarding-create-submit')).toBeDisabled();
    expect(screen.getByTestId('onboarding-create-cancel')).toBeDisabled();
  });

  it('cancel collapses back to the CTA', () => {
    render(<OnboardingCard onCreated={jest.fn()} onDismiss={jest.fn()} />);

    fireEvent.click(screen.getByTestId('onboarding-create-open'));
    fireEvent.click(screen.getByTestId('onboarding-create-cancel'));

    expect(screen.getByTestId('onboarding-create-open')).toBeInTheDocument();
    expect(screen.queryByTestId('tenant-create-form')).not.toBeInTheDocument();
  });
});
