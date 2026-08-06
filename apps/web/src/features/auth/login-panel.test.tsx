import { render, screen } from '@testing-library/react';
import { HomeAuthGate } from '@/features/auth/login-panel';
import { useMe } from '@/features/auth/me';
import { ENTRA_PROVIDER_ID } from '@/features/auth/auth-urls';

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

describe('HomeAuthGate', () => {
  const previousBase = process.env.NEXT_PUBLIC_API_BASE_URL;

  afterEach(() => {
    if (previousBase === undefined) {
      delete process.env.NEXT_PUBLIC_API_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_API_BASE_URL = previousBase;
    }
  });

  it('shows a loading state while resolving the session', () => {
    mockUseMe.mockReturnValue({ data: undefined, isLoading: true });

    render(<HomeAuthGate />);

    expect(screen.getByTestId('login-loading')).toBeInTheDocument();
  });

  it('shows Sign in with Microsoft on / when signed out (API base)', () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.example.test';
    mockUseMe.mockReturnValue({ data: null, isLoading: false });

    render(<HomeAuthGate />);

    const cta = screen.getByTestId('login-sign-in');
    expect(cta).toHaveTextContent('Sign in with Microsoft');
    expect(cta.getAttribute('href')).toContain(
      `https://api.example.test/api/auth/signin/${ENTRA_PROVIDER_ID}`,
    );
  });

  it('shows the home shell with sign out when signed in', () => {
    mockUseMe.mockReturnValue({
      data: { id: '1', email: 'a@b.co', name: 'A', role: 'tenant-admin' },
      isLoading: false,
    });

    render(<HomeAuthGate />);

    expect(screen.getByTestId('home-shell')).toBeInTheDocument();
    expect(screen.getByTestId('login-sign-out')).toBeInTheDocument();
  });
});
