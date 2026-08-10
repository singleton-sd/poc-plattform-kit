import { render, screen } from '@testing-library/react';
import ChangelogPage from './page';

describe('ChangelogPage', () => {
  it('shows the release version, change, and reason', () => {
    render(<ChangelogPage />);

    expect(screen.getByRole('heading', { name: 'What’s new' })).toBeInTheDocument();
    expect(screen.getByText('Version 0.15.0')).toBeInTheDocument();
    expect(screen.getByText(/Return all Entra app roles/)).toBeInTheDocument();
    expect(screen.getByText(/Preserve roles\[\] on AuthenticatedUser/)).toBeInTheDocument();
  });

  it('shows the previous tagged versions', () => {
    render(<ChangelogPage />);

    expect(screen.getByText('Version 0.1.0')).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(16);
  });
});
