import { render, screen } from '@testing-library/react';
import TenantSettingsPage from './page';
import { useMe } from '@/features/auth/me';

jest.mock('@/features/auth/me', () => ({
  useMe: jest.fn(),
}));

jest.mock('@/features/tenant-settings/tenant-settings', () => ({
  TenantSettings: () => <div data-testid="tenant-settings-stub" />,
}));

const mockUseMe = useMe as jest.Mock;

describe('TenantSettingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  it('restricts access when the user lacks the tenant-admin role', () => {
    mockUseMe.mockReturnValue({
      data: { role: 'support-agent' },
      isLoading: false,
      isError: false,
    });

    render(<TenantSettingsPage />);

    expect(screen.getByTestId('tenant-settings-page-restricted')).toBeInTheDocument();
    expect(screen.getByTestId('tenant-settings-page-login-link')).toHaveTextContent(
      'Switch account',
    );
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
      data: { role: 'tenant-admin' },
      isLoading: false,
      isError: false,
    });

    render(<TenantSettingsPage />);

    expect(screen.getByTestId('tenant-settings-page-shell')).toBeInTheDocument();
    expect(screen.getByTestId('tenant-settings-stub')).toBeInTheDocument();
  });
});
