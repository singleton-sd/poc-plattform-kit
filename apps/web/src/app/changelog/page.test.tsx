import { render, screen } from '@testing-library/react';
import ChangelogPage from './page';

describe('ChangelogPage', () => {
  it('shows the release version, change, and reason', () => {
    render(<ChangelogPage />);

    expect(screen.getByRole('heading', { name: 'What’s new' })).toBeInTheDocument();
    expect(screen.getByText('Version 0.15.0')).toBeInTheDocument();
    expect(screen.getByText(/Release notes are now available/)).toBeInTheDocument();
    expect(screen.getByText(/quickly understand what changed and why/)).toBeInTheDocument();
  });
});
