import { render, screen } from '@testing-library/react';
import LoginPage from './page';
import { useMe } from '@/features/auth/me';
import { ENTRA_PROVIDER_ID } from '@/features/auth/auth-urls';

const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: jest.fn(),
  }),
}));

jest.mock('@/features/auth/me', () => ({
  useMe: jest.fn(),
  meKeys: { all: ['me'] },
}));

const mockUseMe = useMe as jest.Mock;

describe('LoginPage', () => {
  beforeEach(() => {
    mockReplace.mockClear();
  });

  it('shows a loading state while resolving the session', () => {
    mockUseMe.mockReturnValue({ data: undefined, isLoading: true });

    render(<LoginPage />);

    expect(screen.getByTestId('login-loading')).toBeInTheDocument();
  });

  it('shows Sign in with Microsoft when signed out', () => {
    mockUseMe.mockReturnValue({ data: null, isLoading: false });

    render(<LoginPage />);

    const cta = screen.getByTestId('login-sign-in');
    expect(cta).toHaveTextContent('Sign in with Microsoft');
    expect(cta).toHaveAttribute('href', `/api/auth/signin/${ENTRA_PROVIDER_ID}?callbackUrl=%2F`);
  });

  it('redirects signed-in users to / and offers sign out', () => {
    mockUseMe.mockReturnValue({
      data: { id: '1', email: 'a@b.co', name: 'A', role: 'tenant-admin' },
      isLoading: false,
    });

    render(<LoginPage />);

    expect(screen.getByTestId('login-signed-in')).toBeInTheDocument();
    expect(screen.getByTestId('login-sign-out')).toBeInTheDocument();
    expect(mockReplace).toHaveBeenCalledWith('/');
  });
});
