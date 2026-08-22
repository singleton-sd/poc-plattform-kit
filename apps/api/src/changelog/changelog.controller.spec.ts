import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ChangelogController } from './changelog.controller';
import changelog = require('./changelog.json');

const apiPackage = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8')) as {
  version: string;
};

describe('ChangelogController', () => {
  it('returns recent releases with an explanation of the change', () => {
    const result = new ChangelogController().getChangelog();
    const oldestRelease = changelog.releases[changelog.releases.length - 1];

    expect(result.product).toBe('@poc-plattform-kit/api');
    expect(result.releases[0]).toEqual(
      expect.objectContaining({
        version: expect.any(String),
        date: expect.any(String),
        changes: expect.arrayContaining([
          expect.objectContaining({
            type: expect.any(String),
            summary: expect.any(String),
            reason: expect.any(String),
          }),
        ]),
      }),
    );
    expect(result.releases[0]?.version).toBe(apiPackage.version);
    expect(result.releases[0]?.version).toBe(changelog.releases[0]?.version);
    expect(result.releases[result.releases.length - 1]?.version).toBe(oldestRelease?.version);
    expect(result.releases.length).toBe(changelog.releases.length);
    expect(result.releases.length).toBeGreaterThan(1);
  });
});
