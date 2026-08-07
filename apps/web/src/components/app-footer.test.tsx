import { render, screen } from '@testing-library/react';
import { AppFooter } from './app-footer';

describe('AppFooter', () => {
  const previous = process.env.NEXT_PUBLIC_APP_VERSION;

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.NEXT_PUBLIC_APP_VERSION;
    } else {
      process.env.NEXT_PUBLIC_APP_VERSION = previous;
    }
  });

  it('renders the app version from NEXT_PUBLIC_APP_VERSION', () => {
    process.env.NEXT_PUBLIC_APP_VERSION = '1.2.3';

    render(<AppFooter />);

    expect(screen.getByTestId('app-footer')).toHaveTextContent('v1.2.3');
    expect(screen.getByTestId('app-footer')).toHaveTextContent('Platform Kit');
  });
});
