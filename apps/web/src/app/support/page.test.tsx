import { fireEvent, render, screen } from '@testing-library/react';
import SupportPage from './page';
import { useMe } from '@/features/auth/me';

const mockFindTenant = jest.fn();
const mockConfigureApiClient = jest.fn();

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

  it('shows a loading state while resolving the session', () => {
    mockUseMe.mockReturnValue({ data: undefined, isLoading: true, isError: false });

    render(<SupportPage />);

    expect(screen.getByTestId('support-loading')).toBeInTheDocument();
  });

  it('shows an error state when the session query fails', () => {
    mockUseMe.mockReturnValue({ data: undefined, isLoading: false, isError: true });

    render(<SupportPage />);

    expect(screen.getByTestId('support-error')).toBeInTheDocument();
  });

  it('restricts access when the user lacks the support-agent role', () => {
    mockUseMe.mockReturnValue({
      data: { role: 'tenant-admin' },
      isLoading: false,
      isError: false,
    });

    render(<SupportPage />);

    expect(screen.getByTestId('support-restricted')).toBeInTheDocument();
    expect(screen.getByTestId('support-login-link')).toHaveAttribute('href', '/');
  });

  it('links signed-out users to /', () => {
    mockUseMe.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
    });

    render(<SupportPage />);

    expect(screen.getByTestId('support-restricted')).toBeInTheDocument();
    expect(screen.getByTestId('support-login-link')).toHaveTextContent('Sign in');
    expect(screen.getByTestId('support-login-link')).toHaveAttribute('href', '/');
  });

  it('renders the shell for a support-agent', () => {
    mockUseMe.mockReturnValue({
      data: { role: 'support-agent' },
      isLoading: false,
      isError: false,
    });

    render(<SupportPage />);

    expect(screen.getByTestId('support-shell')).toBeInTheDocument();
  });

  it('looks up and displays a tenant by id for a support-agent', () => {
    mockUseMe.mockReturnValue({
      data: { role: 'support-agent' },
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
      data: { role: 'support-agent' },
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
