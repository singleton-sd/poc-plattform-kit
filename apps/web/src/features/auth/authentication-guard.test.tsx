import { render, screen, fireEvent } from '@testing-library/react';
import { AuthenticationGuard } from './authentication-guard';
import { useMe } from './me';

jest.mock('./me', () => ({
  useMe: jest.fn(),
}));

const mockUseMe = useMe as jest.Mock;

describe('AuthenticationGuard', () => {
  it('shows loading when session is loading', () => {
    mockUseMe.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    render(
      <AuthenticationGuard>
        <div data-testid="protected">ok</div>
      </AuthenticationGuard>,
    );
    expect(screen.getByTestId('auth-guard-loading')).toBeInTheDocument();
  });

  it('shows error and retry when session check errors', () => {
    const refetch = jest.fn();
    mockUseMe.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch });
    render(
      <AuthenticationGuard>
        <div data-testid="protected">ok</div>
      </AuthenticationGuard>,
    );
    expect(screen.getByTestId('auth-guard-error')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('auth-guard-retry'));
    expect(refetch).toHaveBeenCalled();
  });

  it('shows LoginPanel when signed out (me null)', () => {
    mockUseMe.mockReturnValue({ data: null, isLoading: false, isError: false });
    render(
      <AuthenticationGuard>
        <div data-testid="protected">ok</div>
      </AuthenticationGuard>,
    );
    // LoginPanel exposes login-sign-in button
    expect(screen.getByTestId('login-sign-in')).toBeInTheDocument();
  });

  it('renders children when authenticated', () => {
    mockUseMe.mockReturnValue({ data: { id: '1', email: 'a@b.co', name: 'A', roles: [] }, isLoading: false, isError: false });
    render(
      <AuthenticationGuard>
        <div data-testid="protected">ok</div>
      </AuthenticationGuard>,
    );
    expect(screen.getByTestId('protected')).toBeInTheDocument();
  });
});
