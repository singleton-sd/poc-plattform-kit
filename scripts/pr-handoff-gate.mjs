#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const blockingConclusions = new Set([
  'ACTION_REQUIRED',
  'CANCELLED',
  'FAILURE',
  'STALE',
  'STARTUP_FAILURE',
  'TIMED_OUT',
]);
const terminalConclusions = new Set(['NEUTRAL', 'SKIPPED', 'SUCCESS']);

export function expectedChecks(paths) {
  const checks = new Set(['conflict-on-pr']);
  const rootCi = paths.some((path) =>
    ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'].includes(path),
  );
  const apiPreview = paths.some((path) => /^(apps\/api|pillars|packages)\//.test(path));
  const webPreview = paths.some((path) => /^(apps\/web|packages)\//.test(path));
  const marketingPreview = paths.some((path) => /^apps\/marketing\//.test(path));
  const webCi =
    webPreview ||
    marketingPreview ||
    paths.some((path) => /^apps\/marketing-oauth\//.test(path)) ||
    rootCi;
  if (apiPreview || rootCi) checks.add('Lint / test / build (api)');
  if (apiPreview) checks.add('Build and deploy ACA preview');
  if (webCi) checks.add('Lint / format / build (web)');
  if (webPreview) checks.add('Build + SWA preview');
  if (marketingPreview) checks.add('Build + marketing SWA preview');
  return [...checks];
}

export function evaluateSnapshot(snapshot, nowMs, quietMs) {
  const byName = new Map(snapshot.checks.map((check) => [check.name, check]));
  const missing = snapshot.expected.filter((name) => !byName.has(name));
  const pending = snapshot.expected.filter((name) => {
    const check = byName.get(name);
    return check && check.status !== 'COMPLETED';
  });
  const failed = snapshot.checks.filter((check) => blockingConclusions.has(check.conclusion));
  const incomplete = snapshot.checks.filter(
    (check) => check.status !== 'COMPLETED' || !terminalConclusions.has(check.conclusion),
  );
  const blockers = [];
  if (snapshot.headOid !== snapshot.observedHeadOid) blockers.push('PR head changed');
  if (snapshot.mergeable !== 'MERGEABLE' || snapshot.mergeStateStatus === 'DIRTY') {
    blockers.push(`mergeability is ${snapshot.mergeable}/${snapshot.mergeStateStatus}`);
  }
  if (
    snapshot.labels.some((label) => ['ci-failed', 'has-feedback', 'needs-rebase'].includes(label))
  ) {
    blockers.push(`blocking labels: ${snapshot.labels.join(', ')}`);
  }
  if (snapshot.unresolvedThreads > 0)
    blockers.push(`${snapshot.unresolvedThreads} unresolved review thread(s)`);
  if (missing.length) blockers.push(`checks not registered: ${missing.join(', ')}`);
  if (pending.length) blockers.push(`checks pending: ${pending.join(', ')}`);
  if (failed.length)
    blockers.push(`checks failed: ${failed.map((check) => check.name).join(', ')}`);
  if (incomplete.length && !pending.length && !failed.length) {
    blockers.push(`checks not successful: ${incomplete.map((check) => check.name).join(', ')}`);
  }
  const quietFor = nowMs - snapshot.lastActivityMs;
  if (quietFor < quietMs) blockers.push(`review quiet period: ${quietFor}ms/${quietMs}ms`);
  return { ready: blockers.length === 0, blockers };
}

function gh(args, options = {}) {
  const result = spawnSync('gh', args, { encoding: 'utf8', ...options });
  if (result.status !== 0) throw new Error(result.stderr.trim() || `gh ${args.join(' ')} failed`);
  return result.stdout;
}

function paginated(endpoint) {
  const pages = JSON.parse(gh(['api', '--paginate', '--slurp', `${endpoint}?per_page=100`]));
  return pages.flat();
}

function externalActivityMs(pr, author) {
  const issueComments = paginated(`repos/${pr.repository}/issues/${pr.number}/comments`);
  const reviewComments = paginated(`repos/${pr.repository}/pulls/${pr.number}/comments`);
  const reviews = paginated(`repos/${pr.repository}/pulls/${pr.number}/reviews`);
  const interesting = [...issueComments, ...reviewComments, ...reviews].filter((item) => {
    const login = item.user?.login ?? '';
    if (!login || login === author || login === 'github-actions[bot]') return false;
    const lower = login.toLowerCase();
    const body = (item.body ?? '').toLowerCase();
    if (body.includes("couldn't run - usage limit reached")) return false;
    return (
      /bugbot|cursor|codex|chatgpt/.test(lower) ||
      ['OWNER', 'MEMBER', 'COLLABORATOR', 'CONTRIBUTOR'].includes(item.author_association)
    );
  });
  return Math.max(
    0,
    ...interesting.map((item) =>
      Date.parse(item.updated_at ?? item.submitted_at ?? item.created_at),
    ),
  );
}

function unresolvedThreads(pr) {
  const query = `query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){pullRequest(number:$number){reviewThreads(first:100){nodes{isResolved isOutdated}}}}}`;
  const output = gh([
    'api',
    'graphql',
    '-f',
    `query=${query}`,
    '-F',
    `owner=${pr.owner}`,
    '-F',
    `name=${pr.name}`,
    '-F',
    `number=${pr.number}`,
  ]);
  const nodes = JSON.parse(output).data.repository.pullRequest.reviewThreads.nodes;
  return nodes.filter((thread) => !thread.isResolved && !thread.isOutdated).length;
}

function loadSnapshot(number, observedHeadOid) {
  const repository = gh([
    'repo',
    'view',
    '--json',
    'nameWithOwner',
    '--jq',
    '.nameWithOwner',
  ]).trim();
  const [owner, name] = repository.split('/');
  const view = JSON.parse(
    gh([
      'pr',
      'view',
      String(number),
      '--json',
      'author,headRefOid,labels,mergeable,mergeStateStatus,statusCheckRollup',
    ]),
  );
  const paths = gh(['pr', 'diff', String(number), '--name-only'])
    .trim()
    .split('\n')
    .filter(Boolean);
  const checks = (view.statusCheckRollup ?? [])
    .map((check) => ({
      name: check.name ?? check.context,
      status: check.status ?? 'COMPLETED',
      conclusion: (check.conclusion ?? check.state ?? '').toUpperCase(),
      completedAt: check.completedAt,
    }))
    // The server workflow publishes this status before running the gate. It
    // must not wait on itself.
    .filter((check) => check.name !== 'pr-handoff-gate');
  const checkActivity = Math.max(
    0,
    ...checks.map((check) => Date.parse(check.completedAt || 0)).filter(Number.isFinite),
  );
  const pr = { repository, owner, name, number };
  return {
    headOid: view.headRefOid,
    observedHeadOid,
    mergeable: view.mergeable,
    mergeStateStatus: view.mergeStateStatus,
    labels: (view.labels ?? []).map((label) => label.name),
    checks,
    expected: expectedChecks(paths),
    unresolvedThreads: unresolvedThreads(pr),
    lastActivityMs: Math.max(checkActivity, externalActivityMs(pr, view.author.login)),
  };
}

export async function runGate({ pr, quietMs, timeoutMs, pollMs, once = false }) {
  const initial = JSON.parse(gh(['pr', 'view', String(pr), '--json', 'headRefOid']));
  const observedHeadOid = initial.headRefOid;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    const snapshot = loadSnapshot(pr, observedHeadOid);
    const result = evaluateSnapshot(snapshot, Date.now(), quietMs);
    if (result.ready) {
      process.stdout.write(`PR #${pr} handoff gate passed at ${snapshot.headOid}\n`);
      return;
    }
    process.stderr.write(`PR #${pr} not ready: ${result.blockers.join('; ')}\n`);
    if (once) throw new Error('PR handoff gate did not pass');
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  throw new Error('PR handoff gate timed out');
}

function parseArgs(argv) {
  const value = (name, fallback) => {
    const index = argv.indexOf(name);
    return index === -1 ? fallback : argv[index + 1];
  };
  const pr = Number(value('--pr', process.env.PR_NUMBER));
  if (!Number.isInteger(pr) || pr <= 0) throw new Error('--pr is required');
  return {
    pr,
    quietMs: Number(value('--quiet-seconds', process.env.PR_GATE_QUIET_SECONDS ?? '90')) * 1000,
    timeoutMs:
      Number(value('--timeout-seconds', process.env.PR_GATE_TIMEOUT_SECONDS ?? '1800')) * 1000,
    pollMs: Number(value('--poll-seconds', process.env.PR_GATE_POLL_SECONDS ?? '10')) * 1000,
    once: argv.includes('--once'),
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runGate(parseArgs(process.argv.slice(2))).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
