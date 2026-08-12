import { fireEvent, render, screen } from '@testing-library/react';
import SupportPage from './page';
import { useMe } from '@/features/auth/me';

const mockFindTenant = jest.fn();
const mockConfigureApiClient = jest.fn();

jest.mock('@tanstack/react-query', () => {
  const actual = jest.requireActual(
    '@tanstack/react-query',
  ) as typeof import('@tanstack/react-query');
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: jest.fn() }),
  };
});

jest.mock('@/features/auth/me', () => ({
  useMe: jest.fn(),
}));

jest.mock('@poc-plattform-kit/api-client', () => ({
  useTenantControllerFindOne: (...args: unknown[]) => mockFindTenant(...args),
}));

jest.mock('@/lib/api-client', () => ({
  configureApiClient: (...args: unknown[]) => mockConfigureApiClient(...args),
}));

const mockUseMe = useMe as jest.Mock;

describe('SupportPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindTenant.mockReturnValue({
      data: undefined,
      error: null,
      isError: false,
      isFetching: false,
      refetch: jest.fn(),
    });
  });

  it('shows the shared auth-guard loading state while resolving the session', () => {
    mockUseMe.mockReturnValue({ data: undefined, isLoading: true, isError: false });

    render(<SupportPage />);

    expect(screen.getByTestId('auth-guard-loading')).toBeInTheDocument();
  });

  it('shows the shared auth-guard error state when the session query fails', () => {
    mockUseMe.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: jest.fn(),
    });

    render(<SupportPage />);

    expect(screen.getByTestId('auth-guard-error')).toBeInTheDocument();
  });

  it('restricts access when the user lacks the support-agent role', () => {
    mockUseMe.mockReturnValue({
      data: { roles: ['tenant-admin'] },
      isLoading: false,
      isError: false,
    });

    render(<SupportPage />);

    expect(screen.getByTestId('support-restricted')).toBeInTheDocument();
    expect(screen.getByTestId('support-login-link')).toHaveAttribute('href', '/');
    expect(screen.getByTestId('support-login-link')).toHaveTextContent('Switch account');
  });

  it('shows LoginPanel on the current route when signed out', () => {
    mockUseMe.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
    });

    render(<SupportPage />);

    expect(screen.getByTestId('login-sign-in')).toBeInTheDocument();
    expect(screen.queryByTestId('support-restricted')).not.toBeInTheDocument();
    expect(screen.queryByTestId('support-shell')).not.toBeInTheDocument();
  });

  it('renders the shell for a support-agent', () => {
    mockUseMe.mockReturnValue({
      data: { roles: ['support-agent'] },
      isLoading: false,
      isError: false,
    });

    render(<SupportPage />);

    expect(screen.getByTestId('support-shell')).toBeInTheDocument();
  });

  it('renders the shell when support-agent is one of multiple roles', () => {
    mockUseMe.mockReturnValue({
      data: { roles: ['tenant-admin', 'support-agent'] },
      isLoading: false,
      isError: false,
    });

    render(<SupportPage />);

    expect(screen.getByTestId('support-shell')).toBeInTheDocument();
  });

  it('looks up and displays a tenant by id for a support-agent', () => {
    mockUseMe.mockReturnValue({
      data: { roles: ['support-agent'] },
      isLoading: false,
      isError: false,
    });
    mockFindTenant.mockImplementation((id: string) => ({
      data:
        id === 'tenant-42'
          ? {
              data: { id: 'tenant-42', name: 'Acme Corp', slug: 'acme' },
              status: 200,
              headers: new Headers(),
            }
          : undefined,
      error: null,
      isError: false,
      isFetching: false,
      refetch: jest.fn(),
    }));

    render(<SupportPage />);
    fireEvent.change(screen.getByLabelText('Tenant id'), {
      target: { value: '  tenant-42  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Look up tenant' }));

    expect(mockFindTenant).toHaveBeenLastCalledWith(
      'tenant-42',
      expect.objectContaining({ query: expect.objectContaining({ enabled: true }) }),
    );
    expect(mockConfigureApiClient).toHaveBeenCalledWith({ tenantId: 'tenant-42' });
    expect(screen.getByTestId('support-tenant-result')).toHaveTextContent('Acme Corp');
    expect(screen.getByTestId('support-tenant-result')).toHaveTextContent('tenant-42');
  });

  it.each([
    {
      name: 'loading',
      query: { isFetching: true },
      message: 'Loading tenant…',
      role: 'status',
    },
    {
      name: 'not found',
      query: { error: { status: 404 }, isError: true },
      message: 'No tenant was found with id tenant-42.',
      role: 'alert',
    },
    {
      name: 'error',
      query: { error: { status: 500 }, isError: true },
      message: 'Tenant lookup failed. Try again later.',
      role: 'alert',
    },
  ])('shows the tenant $name state', ({ query, message, role }) => {
    mockUseMe.mockReturnValue({
      data: { roles: ['support-agent'] },
      isLoading: false,
      isError: false,
    });
    mockFindTenant.mockImplementation((id: string) => ({
      data: undefined,
      error: null,
      isError: false,
      isFetching: false,
      refetch: jest.fn(),
      ...(id === 'tenant-42' ? query : {}),
    }));

    render(<SupportPage />);
    fireEvent.change(screen.getByLabelText('Tenant id'), {
      target: { value: 'tenant-42' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Look up tenant' }));

    expect(screen.getByRole(role)).toHaveTextContent(message);
  });
});
