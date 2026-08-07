import { fireEvent, render, screen } from '@testing-library/react';
import { HomeAuthGate } from '@/features/auth/login-panel';
import { useMe } from '@/features/auth/me';
import { signIn } from '@/features/auth/auth-urls';

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: jest.fn(),
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

const mockUseMe = useMe as jest.Mock;
const mockSignIn = signIn as jest.Mock;

describe('HomeAuthGate', () => {
  beforeEach(() => {
    mockSignIn.mockReset();
  });

  it('shows a loading state while resolving the session', () => {
    mockUseMe.mockReturnValue({ data: undefined, isLoading: true, isError: false });

    render(<HomeAuthGate />);

    expect(screen.getByTestId('login-loading')).toBeInTheDocument();
  });

  it('shows a session error with retry when useMe fails', () => {
    const refetch = jest.fn();
    mockUseMe.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch });

    render(<HomeAuthGate />);

    expect(screen.getByTestId('login-session-error')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('login-session-retry'));
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

  it('shows the home shell with sign out when signed in', () => {
    mockUseMe.mockReturnValue({
      data: { id: '1', email: 'a@b.co', name: 'A', role: 'tenant-admin' },
      isLoading: false,
      isError: false,
    });

    render(<HomeAuthGate />);

    expect(screen.getByTestId('home-shell')).toBeInTheDocument();
    expect(screen.getByTestId('brand-mark')).toHaveTextContent('Platform Kit.');
    expect(screen.getByTestId('login-sign-out')).toBeInTheDocument();
  });
});
