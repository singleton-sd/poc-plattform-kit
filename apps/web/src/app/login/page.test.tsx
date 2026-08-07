import { render, screen } from '@testing-library/react';
import LoginRedirectPage from './page';

const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

describe('LoginRedirectPage', () => {
  it('redirects /login to /', () => {
    render(<LoginRedirectPage />);

    expect(screen.getByTestId('login-redirect')).toBeInTheDocument();
    expect(mockReplace).toHaveBeenCalledWith('/');
  });
});
