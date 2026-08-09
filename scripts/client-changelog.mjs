import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const CLIENT_CHANGELOG_TARGETS = {
  '@poc-plattform-kit/web': {
    markdown: 'apps/web/CHANGELOG.md',
    data: 'apps/web/src/content/changelog.json',
  },
  '@poc-plattform-kit/api': {
    markdown: 'apps/api/CHANGELOG.md',
    data: 'apps/api/src/changelog/changelog.json',
  },
  '@poc-plattform-kit/marketing': {
    markdown: 'apps/marketing/CHANGELOG.md',
    data: 'apps/marketing/src/data/changelog.json',
  },
};

const CHANGE_TYPES = { feat: 'New', fix: 'Fixed', perf: 'Improved' };
const DISPLAY_TYPES = ['Breaking', 'New', 'Fixed', 'Improved'];

/** Convert the conventional commits consumed by release-it into public copy. */
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
      .replace(/\s+\(#\d+\)$/, '')
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

export function formatProductChangelog(product, releases) {
  const sections = releases.map((release) => {
    const groups = DISPLAY_TYPES.flatMap((type) => {
      const changes = release.changes.filter((change) => change.type === type);
      if (!changes.length) return [];
      return [
        `### ${type}`,
        '',
        ...changes.flatMap((change) => [
          `- ${change.summary}`,
          ...(change.reason ? ['', `  ${change.reason}`] : []),
          '',
        ]),
      ];
    });
    return [`## ${release.version} — ${release.date}`, '', ...groups].join('\n').trimEnd();
  });
  return `# Changelog\n\nRelease history for **${product}**, generated from conventional commits by the release-it workflow.\n\n${sections.join('\n\n')}\n`;
}

export function parseProductChangelog(markdown) {
  const releases = [];
  let release;
  let type;
  let change;
  for (const rawLine of markdown.split('\n')) {
    const line = rawLine.trimEnd();
    const releaseMatch = line.match(/^## (\S+) — (\d{4}-\d{2}-\d{2})$/);
    if (releaseMatch) {
      release = { version: releaseMatch[1], date: releaseMatch[2], changes: [] };
      releases.push(release);
      change = undefined;
      continue;
    }
    const typeMatch = line.match(/^### (Breaking|New|Fixed|Improved)$/);
    if (typeMatch) {
      type = typeMatch[1];
      change = undefined;
      continue;
    }
    if (release && type && line.startsWith('- ')) {
      change = { type, summary: line.slice(2) };
      release.changes.push(change);
      continue;
    }
    if (change && /^\s{2}\S/.test(rawLine)) change.reason = rawLine.trim();
  }
  return releases;
}

export function updateClientChangelogs(root, releases, date) {
  for (const release of releases) {
    const targets = CLIENT_CHANGELOG_TARGETS[release.name];
    if (!targets) continue;

    const markdownPath = join(root, targets.markdown);
    const existing = existsSync(markdownPath)
      ? parseProductChangelog(readFileSync(markdownPath, 'utf8'))
      : [];
    const next = [
      {
        version: release.next,
        date,
        changes: clientFacingChanges(release.messages),
      },
      ...existing,
    ];

    mkdirSync(dirname(markdownPath), { recursive: true });
    writeFileSync(markdownPath, formatProductChangelog(release.name, next));

    // The committed JSON is a deployment projection; Markdown is canonical.
    const projected = parseProductChangelog(readFileSync(markdownPath, 'utf8'));
    const dataPath = join(root, targets.data);
    mkdirSync(dirname(dataPath), { recursive: true });
    writeFileSync(
      dataPath,
      `${JSON.stringify({ product: release.name, releases: projected }, null, 2)}\n`,
    );
  }
}
