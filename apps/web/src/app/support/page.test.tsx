import { render, screen } from '@testing-library/react';
import SupportPage from './page';
import { useMe } from '@/features/auth/me';

jest.mock('@/features/auth/me', () => ({
  useMe: jest.fn(),
}));

const mockUseMe = useMe as jest.Mock;

describe('SupportPage', () => {
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
});
