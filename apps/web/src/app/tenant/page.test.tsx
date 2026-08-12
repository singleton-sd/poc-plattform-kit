import { render, screen } from '@testing-library/react';
import TenantSettingsPage from './page';
import { useMe } from '@/features/auth/me';

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

  it('shows a loading state while resolving the session', () => {
    mockUseMe.mockReturnValue({ data: undefined, isLoading: true, isError: false });

    render(<TenantSettingsPage />);

    expect(screen.getByTestId('tenant-settings-page-loading')).toBeInTheDocument();
  });

  it('shows an error state when the session query fails', () => {
    mockUseMe.mockReturnValue({ data: undefined, isLoading: false, isError: true });

    render(<TenantSettingsPage />);

    expect(screen.getByTestId('tenant-settings-page-error')).toBeInTheDocument();
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

  it('links signed-out users to sign in', () => {
    mockUseMe.mockReturnValue({ data: null, isLoading: false, isError: false });

    render(<TenantSettingsPage />);

    expect(screen.getByTestId('tenant-settings-page-restricted')).toBeInTheDocument();
    expect(screen.getByTestId('tenant-settings-page-login-link')).toHaveTextContent('Sign in');
    expect(screen.getByTestId('tenant-settings-page-login-link')).toHaveAttribute('href', '/');
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
