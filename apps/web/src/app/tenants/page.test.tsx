import { render, screen } from '@testing-library/react';
import TenantsPage from './page';
import { useMe } from '@/features/auth/me';

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

jest.mock('@/features/tenants/tenant-workspace', () => ({
  TenantWorkspace: () => <div data-testid="tenant-workspace-stub" />,
}));

const mockUseMe = useMe as jest.Mock;

describe('TenantsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the shared auth-guard loading state while resolving the session', () => {
    mockUseMe.mockReturnValue({ data: undefined, isLoading: true, isError: false });

    render(<TenantsPage />);

    expect(screen.getByTestId('auth-guard-loading')).toBeInTheDocument();
  });

  it('shows LoginPanel on the current route when signed out', () => {
    mockUseMe.mockReturnValue({ data: null, isLoading: false, isError: false });

    render(<TenantsPage />);

    expect(screen.getByTestId('login-sign-in')).toBeInTheDocument();
    expect(screen.queryByTestId('tenants-page-shell')).not.toBeInTheDocument();
  });

  it('renders the workspace for a signed-in user', () => {
    mockUseMe.mockReturnValue({
      data: { roles: [] },
      isLoading: false,
      isError: false,
    });

    render(<TenantsPage />);

    expect(screen.getByTestId('tenants-page-shell')).toBeInTheDocument();
    expect(screen.getByTestId('tenant-workspace-stub')).toBeInTheDocument();
  });
});
