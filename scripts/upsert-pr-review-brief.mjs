#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const BRIEF_MARKER = '<!-- pr-review-brief -->';

const requiredCi = new Set(['Lint / test / build (api)', 'Lint / format / build (web)']);
const previewMarkers = [
  '<!-- swa-preview-web -->',
  '<!-- api-preview-aca -->',
  '<!-- swa-preview-marketing -->',
];

export function nextAction({
  mergeable,
  mergeStateStatus,
  labels = [],
  requiredCiState,
  unresolvedThreads,
}) {
  if (
    mergeable !== 'MERGEABLE' ||
    mergeStateStatus === 'DIRTY' ||
    labels.includes('needs-rebase')
  ) {
    return 'waiting on merge conflicts';
  }
  if (labels.includes('ci-failed') || requiredCiState === 'red') return 'waiting on CI';
  if (labels.includes('has-feedback') || unresolvedThreads > 0) return 'agent fixing comments';
  if (requiredCiState === 'pending') return 'waiting on CI';
  return 'READY FOR HUMAN';
}

export function formatBrief(snapshot) {
  const lines = [
    BRIEF_MARKER,
    `## Human Review Brief — ${snapshot.title}`,
    '',
    snapshot.ticketTitle ? `- **Ticket:** ${snapshot.ticketTitle}` : null,
    snapshot.prUrl ? `- **PR:** ${snapshot.prUrl}` : null,
    '',
    '### Summary',
    snapshot.summary || '_No PR summary._',
    '',
    '### Test evidence',
  ].filter((line) => line !== null);

  if (snapshot.localCommands?.length) {
    for (const command of snapshot.localCommands) lines.push(`- \`${command}\``);
  } else {
    lines.push('- Local commands: see PR test plan');
  }

  if (snapshot.checks?.length) {
    for (const check of snapshot.checks) {
      const state = check.conclusion || check.state || check.status || 'unknown';
      const link = check.link ? ` ([log](${check.link}))` : '';
      lines.push(`- ${check.name}: **${state}**${link}`);
    }
  } else {
    lines.push('- Required CI: not registered yet');
  }

  lines.push('', '### Preview URLs');
  if (snapshot.previewUrls?.length) {
    for (const preview of snapshot.previewUrls) lines.push(`- ${preview}`);
  } else {
    lines.push('- None yet (or preview is infra-blocked)');
  }

  lines.push('', '### Open review threads');
  if (snapshot.threads?.length) {
    for (const thread of snapshot.threads) {
      const where = thread.path ? `${thread.path}` : 'conversation';
      lines.push(`- ${thread.author} on \`${where}\`: ${thread.excerpt}`);
    }
  } else {
    lines.push('- None');
  }

  lines.push('', '### Infra blockers');
  if (snapshot.labels?.includes('preview-blocked') || snapshot.infraNotes?.length) {
    if (snapshot.labels?.includes('preview-blocked')) {
      lines.push('- `preview-blocked`: SWA/ACA/Chromatic infra failed. Not a code defect.');
    }
    for (const note of snapshot.infraNotes ?? []) lines.push(`- ${note}`);
    lines.push('- Chromatic visual-accept is human-only.');
  } else {
    lines.push('- None');
  }

  lines.push('', `### Next action`, '', `**${snapshot.nextAction}**`, '');
  return `${lines.join('\n')}\n`;
}

function gh(args) {
  const result = spawnSync('gh', args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr.trim() || `gh ${args.join(' ')} failed`);
  return result.stdout;
}

function summaryFromBody(body) {
  if (!body) return '';
  const text = body.replace(/\r\n/g, '\n');
  const summary = text.match(/##\s*Summary\s*\n+([\s\S]*?)(?=\n##\s|\n*$)/i);
  const excerpt = (summary ? summary[1] : text).trim();
  return excerpt.split('\n').slice(0, 8).join('\n');
}

function loadSnapshot(pr) {
  const view = JSON.parse(
    gh([
      'pr',
      'view',
      String(pr),
      '--json',
      'title,body,url,labels,mergeable,mergeStateStatus,statusCheckRollup,headRefName,comments',
    ]),
  );
  const checks = (view.statusCheckRollup ?? [])
    .map((check) => ({
      name: check.name ?? check.context,
      conclusion: (check.conclusion ?? check.state ?? '').toUpperCase(),
      status: check.status,
      link: check.detailsUrl ?? check.targetUrl,
    }))
    .filter((check) => requiredCi.has(check.name) || check.name === 'conflict-on-pr');
  const requiredFailed = checks.some(
    (check) => requiredCi.has(check.name) && check.conclusion === 'FAILURE',
  );
  const requiredPending = checks.some(
    (check) => requiredCi.has(check.name) && check.status && check.status !== 'COMPLETED',
  );
  const comments = JSON.parse(
    gh(['api', `repos/{owner}/{repo}/issues/${pr}/comments`, '--paginate']),
  );
  const previewUrls = [];
  for (const comment of comments) {
    if (!previewMarkers.some((marker) => comment.body?.includes(marker))) continue;
    const match = comment.body.match(/https?:\/\/\S+/);
    if (match) previewUrls.push(match[0].replace(/[).,]+$/, ''));
  }
  const repository = gh([
    'repo',
    'view',
    '--json',
    'nameWithOwner',
    '--jq',
    '.nameWithOwner',
  ]).trim();
  const [owner, name] = repository.split('/');
  const gql = JSON.parse(
    gh([
      'api',
      'graphql',
      '-f',
      'query=query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){pullRequest(number:$number){reviewThreads(first:50){nodes{isResolved isOutdated comments(first:1){nodes{author{login} body path}}}}}}}',
      '-F',
      `owner=${owner}`,
      '-F',
      `name=${name}`,
      '-F',
      `number=${pr}`,
    ]),
  );
  const threads = (gql.data.repository.pullRequest.reviewThreads.nodes ?? [])
    .filter((node) => !node.isResolved && !node.isOutdated)
    .map((node) => {
      const comment = node.comments.nodes[0] ?? {};
      return {
        author: comment.author?.login ?? 'unknown',
        path: comment.path ?? '',
        excerpt: (comment.body ?? '').replace(/\s+/g, ' ').slice(0, 140),
      };
    });
  const labels = (view.labels ?? []).map((label) => label.name);
  const requiredCiState = requiredFailed ? 'red' : requiredPending ? 'pending' : 'green';
  return {
    title: view.title,
    ticketTitle: view.title,
    prUrl: view.url,
    summary: summaryFromBody(view.body),
    checks,
    previewUrls: [...new Set(previewUrls)],
    threads,
    labels,
    infraNotes: [],
    nextAction: nextAction({
      mergeable: view.mergeable,
      mergeStateStatus: view.mergeStateStatus,
      labels,
      requiredCiState,
      unresolvedThreads: threads.length,
    }),
  };
}

export function upsertBriefComment(pr, body) {
  const comments = JSON.parse(
    gh(['api', `repos/{owner}/{repo}/issues/${pr}/comments`, '--paginate']),
  );
  const existing = comments.find((comment) => comment.body?.includes(BRIEF_MARKER));
  const dir = mkdtempSync(join(tmpdir(), 'pr-brief-'));
  if (existing) {
    const payload = join(dir, 'body.json');
    writeFileSync(payload, JSON.stringify({ body }));
    gh([
      'api',
      `repos/{owner}/{repo}/issues/comments/${existing.id}`,
      '-X',
      'PATCH',
      '--input',
      payload,
    ]);
    return 'updated';
  }
  const markdown = join(dir, 'brief.md');
  writeFileSync(markdown, body);
  gh(['pr', 'comment', String(pr), '--body-file', markdown]);
  return 'created';
}

export function runBrief(pr) {
  const snapshot = loadSnapshot(pr);
  const body = formatBrief(snapshot);
  const action = upsertBriefComment(pr, body);
  process.stdout.write(`Human Review Brief ${action} on PR #${pr}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const index = process.argv.indexOf('--pr');
  const pr = Number(index === -1 ? process.env.PR_NUMBER : process.argv[index + 1]);
  if (!Number.isInteger(pr) || pr <= 0) {
    process.stderr.write('--pr is required\n');
    process.exitCode = 1;
  } else {
    try {
      runBrief(pr);
    } catch (error) {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    }
  }
}
