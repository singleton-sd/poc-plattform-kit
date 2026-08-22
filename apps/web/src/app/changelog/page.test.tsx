import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import changelog from '@/content/changelog.json';
import { render, screen } from '@testing-library/react';
import ChangelogPage from './page';

const webPackage = JSON.parse(readFileSync(join(__dirname, '../../../package.json'), 'utf8')) as {
  version: string;
};

describe('ChangelogPage', () => {
  it('shows the release version, change, and reason', () => {
    render(<ChangelogPage />);
    const latest = changelog.releases[0];
    const firstChange = latest?.changes[0];

    expect(screen.getByRole('heading', { name: 'What’s new' })).toBeInTheDocument();
    expect(latest?.version).toBe(webPackage.version);
    expect(screen.getByText(`Version ${latest.version}`)).toBeInTheDocument();
    expect(firstChange).toBeDefined();
    expect(screen.getByText(firstChange!.summary)).toBeInTheDocument();
    if (firstChange?.reason) {
      expect(screen.getByText(firstChange.reason)).toBeInTheDocument();
    }
  });

  it('shows the previous tagged versions', () => {
    render(<ChangelogPage />);
    const oldest = changelog.releases[changelog.releases.length - 1];

    expect(oldest?.version).toBe('0.1.0');
    expect(screen.getByText('Version 0.1.0')).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(changelog.releases.length);
  });
});
