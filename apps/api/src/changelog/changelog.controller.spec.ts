import { ChangelogController } from './changelog.controller';

describe('ChangelogController', () => {
  it('returns recent releases with an explanation of the change', () => {
    const result = new ChangelogController().getChangelog();

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
  });
});
