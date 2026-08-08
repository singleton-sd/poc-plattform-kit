import { render, screen } from '@testing-library/react';
import { AppFooter } from './app-footer';

describe('AppFooter', () => {
  const previousVersion = process.env.NEXT_PUBLIC_APP_VERSION;
  const previousApiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

  afterEach(() => {
    if (previousVersion === undefined) {
      delete process.env.NEXT_PUBLIC_APP_VERSION;
    } else {
      process.env.NEXT_PUBLIC_APP_VERSION = previousVersion;
    }
    if (previousApiBase === undefined) {
      delete process.env.NEXT_PUBLIC_API_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_API_BASE_URL = previousApiBase;
    }
  });

  it('renders the app version from NEXT_PUBLIC_APP_VERSION', () => {
    process.env.NEXT_PUBLIC_APP_VERSION = '1.2.3';

    render(<AppFooter />);

    expect(screen.getByTestId('app-footer')).toHaveTextContent('v1.2.3');
    expect(screen.getByTestId('app-footer')).toHaveTextContent('Platform Kit');
  });

  it('links API to Swagger docs via NEXT_PUBLIC_API_BASE_URL', () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.plattform-kit.poc.singletonsd.com';

    render(<AppFooter />);

    const apiLink = screen.getByRole('link', { name: 'API' });
    expect(apiLink).toHaveAttribute('href', 'https://api.plattform-kit.poc.singletonsd.com/docs');
    expect(apiLink).toHaveAttribute('target', '_blank');
  });
});
