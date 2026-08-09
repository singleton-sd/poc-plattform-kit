import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

export const CLIENT_CHANGELOG_TARGETS = {
  '@poc-plattform-kit/web': 'apps/web/src/content/changelog.json',
  '@poc-plattform-kit/api': 'apps/api/src/changelog/changelog.json',
  '@poc-plattform-kit/marketing': 'apps/marketing/src/data/changelog.json',
};

const CHANGE_TYPES = {
  feat: 'New',
  fix: 'Fixed',
  perf: 'Improved',
};

/** Convert conventional commits into copy suitable for a public release page. */
export function clientFacingChanges(messages) {
  return messages.flatMap((message) => {
    const [subject = '', ...bodyLines] = message.split('\n');
    const match = subject.match(/^([a-z]+)(?:\([^)]*\))?(!)?:\s*(.+)$/i);
    const breakingFooter = message.match(/^BREAKING CHANGE:\s*(.+)$/im)?.[1]?.trim();
    const isBreaking = Boolean(match?.[2] || breakingFooter);
    if (!match || (!isBreaking && !Object.hasOwn(CHANGE_TYPES, match[1].toLowerCase()))) {
      return [];
    }

    const summary = match[3]
      .replace(/^[A-Z]{1,5}-\d+\s+/, '')
      .replace(/^86[a-z0-9]+\s+/i, '')
      .trim();
    const reason =
      breakingFooter ??
      bodyLines
        .map((line) => line.trim())
        .filter(
          (line) =>
            line &&
            !/^(?:[-*+]\s+|\d+\.\s+|#{1,6}\s+)/.test(line) &&
            !/^(breaking change|closes|fixes|refs|co-authored-by):/i.test(line),
        )[0];

    return [
      {
        type: isBreaking ? 'Breaking' : CHANGE_TYPES[match[1].toLowerCase()],
        summary,
        ...(reason ? { reason } : {}),
      },
    ];
  });
}

export function updateClientChangelogs(root, releases, date) {
  for (const release of releases) {
    const relativeTarget = CLIENT_CHANGELOG_TARGETS[release.name];
    if (!relativeTarget) continue;

    const target = join(root, relativeTarget);
    const existing = existsSync(target)
      ? JSON.parse(readFileSync(target, 'utf8'))
      : { product: release.name, releases: [] };
    const entry = {
      version: release.next,
      date,
      changes: clientFacingChanges(release.messages),
    };

    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(
      target,
      `${JSON.stringify(
        { product: release.name, releases: [entry, ...existing.releases].slice(0, 20) },
        null,
        2,
      )}\n`,
    );
  }
}
