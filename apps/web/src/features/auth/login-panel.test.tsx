import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HomeAuthGate } from '@/features/auth/home-auth-gate';
import { LoginPanel } from '@/features/auth/login-panel';
import { useMe } from '@/features/auth/me';
import { signIn } from '@/features/auth/auth-urls';

const invalidateQueries = jest.fn();
const mutate = jest.fn();

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries,
  }),
}));

jest.mock('@/features/auth/me', () => ({
  useMe: jest.fn(),
  meKeys: { all: ['me'] },
}));

jest.mock('@/features/auth/auth-urls', () => ({
  signIn: jest.fn(),
  signOut: jest.fn(),
}));

// The self-service onboarding card (rendered on the signed-in home shell)
// reuses the generated create-tenant-self-service hook and JsonForms —
// stub both the same way `tenant-create-drawer.test.tsx` /
// `onboarding-card.test.tsx` do so this suite doesn't depend on live
// react-query / JsonForms internals.
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
    isPending: false,
    isError: false,
    error: null,
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

const mockUseMe = useMe as jest.Mock;
const mockSignIn = signIn as jest.Mock;

describe('HomeAuthGate', () => {
  beforeEach(() => {
    mockSignIn.mockReset();
    mutate.mockReset();
    invalidateQueries.mockReset();
    invalidateQueries.mockResolvedValue(undefined);
    window.localStorage.clear();
  });

  it('shows the shared auth-guard loading state while resolving the session', () => {
    mockUseMe.mockReturnValue({ data: undefined, isLoading: true, isError: false });

    render(<HomeAuthGate />);

    expect(screen.getByTestId('auth-guard-loading')).toBeInTheDocument();
  });

  it('shows the shared auth-guard error with retry when useMe fails', () => {
    const refetch = jest.fn();
    mockUseMe.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch });

    render(<HomeAuthGate />);

    expect(screen.getByTestId('auth-guard-error')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('auth-guard-retry'));
    expect(refetch).toHaveBeenCalled();
  });

  it('shows Sign in with Microsoft on / when signed out', () => {
    mockUseMe.mockReturnValue({ data: null, isLoading: false, isError: false });

    render(<HomeAuthGate />);

    expect(screen.getByTestId('brand-mark')).toHaveTextContent('Platform Kit.');
    expect(screen.getByTestId('login-sign-in')).toHaveTextContent('Sign in with Microsoft');
  });

  it('starts Auth.js sign-in on CTA click', () => {
    mockUseMe.mockReturnValue({ data: null, isLoading: false, isError: false });
    mockSignIn.mockResolvedValue(undefined);

    render(<HomeAuthGate />);
    fireEvent.click(screen.getByTestId('login-sign-in'));

    expect(mockSignIn).toHaveBeenCalled();
  });

  it('re-enables the sign-in button when Bearer session stays signed out', async () => {
    mockSignIn.mockResolvedValue(undefined);
    invalidateQueries.mockResolvedValue(undefined);

    render(<LoginPanel />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('login-sign-in'));
    });

    await waitFor(() => {
      expect(invalidateQueries).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByTestId('login-sign-in')).not.toBeDisabled();
    });
  });

  it('shows the home shell with sign out when signed in', () => {
    mockUseMe.mockReturnValue({
      data: { id: '1', email: 'a@b.co', name: 'A', roles: ['tenant-admin'] },
      isLoading: false,
      isError: false,
    });

    render(<HomeAuthGate />);

    expect(screen.getByTestId('home-shell')).toBeInTheDocument();
    expect(screen.getByTestId('brand-mark')).toHaveTextContent('Platform Kit.');
    expect(screen.getByTestId('login-sign-out')).toBeInTheDocument();
  });

  it('offers self-service onboarding on the home shell for a user with no known tenant', () => {
    mockUseMe.mockReturnValue({
      data: { id: 'user-1', email: 'a@b.co', name: 'A', roles: [] },
      isLoading: false,
      isError: false,
    });

    render(<HomeAuthGate />);

    expect(screen.getByTestId('onboarding-card')).toBeInTheDocument();
    // Existing admin links stay reachable alongside onboarding.
    expect(screen.getByRole('link', { name: 'Tenants' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Support' })).toBeInTheDocument();
  });

  it('lands the user in their new tenant as owner after self-service creation', async () => {
    mockUseMe.mockReturnValue({
      data: { id: 'user-1', email: 'a@b.co', name: 'A', roles: [] },
      isLoading: false,
      isError: false,
    });

    render(<HomeAuthGate />);

    fireEvent.click(screen.getByTestId('onboarding-create-open'));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Acme' } });
    fireEvent.click(screen.getByTestId('onboarding-create-submit'));

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({ data: { name: 'Acme', slug: undefined } });
    });
    expect(screen.queryByTestId('onboarding-card')).not.toBeInTheDocument();
    expect(screen.getByTestId('onboarding-success')).toHaveTextContent('Acme');
    // Carries the newly-created tenant's id into /tenant so the settings
    // page's lookup form doesn't need it copy/pasted in manually.
    expect(screen.getByRole('link', { name: 'Manage your tenant' })).toHaveAttribute(
      'href',
      '/tenant?tenantId=t1',
    );
  });

  it('dismisses onboarding without creating a tenant on "Not now"', () => {
    mockUseMe.mockReturnValue({
      data: { id: 'user-1', email: 'a@b.co', name: 'A', roles: [] },
      isLoading: false,
      isError: false,
    });

    render(<HomeAuthGate />);
    fireEvent.click(screen.getByTestId('onboarding-dismiss'));

    expect(screen.queryByTestId('onboarding-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('onboarding-success')).not.toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('shows onboarding again after remount when the user only clicked Not now', () => {
    mockUseMe.mockReturnValue({
      data: { id: 'user-1', email: 'a@b.co', name: 'A', roles: [] },
      isLoading: false,
      isError: false,
    });

    const { unmount } = render(<HomeAuthGate />);
    fireEvent.click(screen.getByTestId('onboarding-dismiss'));
    expect(screen.queryByTestId('onboarding-card')).not.toBeInTheDocument();
    unmount();

    render(<HomeAuthGate />);

    expect(screen.getByTestId('onboarding-card')).toBeInTheDocument();
  });

  it('keeps the manage-tenant link after remount once a tenant was created', async () => {
    mockUseMe.mockReturnValue({
      data: { id: 'user-1', email: 'a@b.co', name: 'A', roles: [] },
      isLoading: false,
      isError: false,
    });

    const { unmount } = render(<HomeAuthGate />);
    fireEvent.click(screen.getByTestId('onboarding-create-open'));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Acme' } });
    fireEvent.click(screen.getByTestId('onboarding-create-submit'));
    await waitFor(() => {
      expect(screen.getByTestId('onboarding-success')).toBeInTheDocument();
    });
    unmount();

    render(<HomeAuthGate />);

    expect(screen.queryByTestId('onboarding-card')).not.toBeInTheDocument();
    expect(screen.getByTestId('onboarding-success')).toHaveTextContent('Acme');
    expect(screen.getByRole('link', { name: 'Manage your tenant' })).toHaveAttribute(
      'href',
      '/tenant?tenantId=t1',
    );
  });

  it('still offers onboarding to a different user on the same browser', async () => {
    mockUseMe.mockReturnValue({
      data: { id: 'user-1', email: 'a@b.co', name: 'A', roles: [] },
      isLoading: false,
      isError: false,
    });
    const { unmount } = render(<HomeAuthGate />);
    fireEvent.click(screen.getByTestId('onboarding-create-open'));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Acme' } });
    fireEvent.click(screen.getByTestId('onboarding-create-submit'));
    await waitFor(() => {
      expect(screen.getByTestId('onboarding-success')).toBeInTheDocument();
    });
    unmount();

    mockUseMe.mockReturnValue({
      data: { id: 'user-2', email: 'b@b.co', name: 'B', roles: [] },
      isLoading: false,
      isError: false,
    });
    render(<HomeAuthGate />);

    expect(screen.getByTestId('onboarding-card')).toBeInTheDocument();
  });
});
