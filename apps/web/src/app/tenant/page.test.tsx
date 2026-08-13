import { render, screen } from '@testing-library/react';
import TenantSettingsPage from './page';
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

let searchParams = new URLSearchParams();
jest.mock('next/navigation', () => ({
  useSearchParams: () => searchParams,
}));

const tenantSettingsSpy = jest.fn();
jest.mock('@/features/tenant-settings/tenant-settings', () => ({
  TenantSettings: (props: { initialTenantId?: string }) => {
    tenantSettingsSpy(props);
    return <div data-testid="tenant-settings-stub" />;
  },
}));

const mockUseMe = useMe as jest.Mock;

describe('TenantSettingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    searchParams = new URLSearchParams();
  });

  it('shows the shared auth-guard loading state while resolving the session', () => {
    mockUseMe.mockReturnValue({ data: undefined, isLoading: true, isError: false });

    render(<TenantSettingsPage />);

    expect(screen.getByTestId('auth-guard-loading')).toBeInTheDocument();
  });

  it('shows the shared auth-guard error state when the session query fails', () => {
    mockUseMe.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: jest.fn(),
    });

    render(<TenantSettingsPage />);

    expect(screen.getByTestId('auth-guard-error')).toBeInTheDocument();
  });

  it('renders the settings shell for any authenticated user, regardless of role', () => {
    // GET/PATCH /tenants/:id remain the real authority server-side (tenancy
    // context + owner membership or tenant-admin for updates). This page
    // can't tell a self-service owner apart from any other signed-in user
    // client-side, so it no longer gates on roles.
    mockUseMe.mockReturnValue({
      data: { roles: ['support-agent'] },
      isLoading: false,
      isError: false,
    });

    render(<TenantSettingsPage />);

    expect(screen.getByTestId('tenant-settings-page-shell')).toBeInTheDocument();
    expect(screen.getByTestId('tenant-settings-stub')).toBeInTheDocument();
  });

  it('renders the settings shell for a signed-in user with no roles at all', () => {
    mockUseMe.mockReturnValue({
      data: { roles: [] },
      isLoading: false,
      isError: false,
    });

    render(<TenantSettingsPage />);

    expect(screen.getByTestId('tenant-settings-page-shell')).toBeInTheDocument();
  });

  it('passes the tenantId query param through to TenantSettings as initialTenantId', () => {
    searchParams = new URLSearchParams('tenantId=t-123');
    mockUseMe.mockReturnValue({
      data: { roles: [] },
      isLoading: false,
      isError: false,
    });

    render(<TenantSettingsPage />);

    expect(tenantSettingsSpy).toHaveBeenCalledWith({ initialTenantId: 't-123' });
  });

  it('passes undefined initialTenantId when no tenantId query param is present', () => {
    mockUseMe.mockReturnValue({
      data: { roles: [] },
      isLoading: false,
      isError: false,
    });

    render(<TenantSettingsPage />);

    expect(tenantSettingsSpy).toHaveBeenCalledWith({ initialTenantId: undefined });
  });

  it('shows LoginPanel on the current route when signed out', () => {
    mockUseMe.mockReturnValue({ data: null, isLoading: false, isError: false });

    render(<TenantSettingsPage />);

    expect(screen.getByTestId('login-sign-in')).toBeInTheDocument();
    expect(screen.queryByTestId('tenant-settings-page-restricted')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tenant-settings-page-shell')).not.toBeInTheDocument();
  });

  it('renders the settings shell for a tenant-admin', () => {
    mockUseMe.mockReturnValue({
      data: { roles: ['tenant-admin'] },
      isLoading: false,
      isError: false,
    });

    render(<TenantSettingsPage />);

    expect(screen.getByTestId('tenant-settings-page-shell')).toBeInTheDocument();
    expect(screen.getByTestId('tenant-settings-stub')).toBeInTheDocument();
  });

  it('renders the shell when tenant-admin is one of multiple roles', () => {
    mockUseMe.mockReturnValue({
      data: { roles: ['support-agent', 'tenant-admin'] },
      isLoading: false,
      isError: false,
    });

    render(<TenantSettingsPage />);

    expect(screen.getByTestId('tenant-settings-page-shell')).toBeInTheDocument();
  });
});
