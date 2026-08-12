import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TASK_ID = /^[0-9][0-9a-z]{5,15}$/i;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLUG_PREFIX = /^(feature|hotfix)(?:-|$)/;

export function assertTaskId(taskId) {
  if (typeof taskId !== 'string' || !TASK_ID.test(taskId)) {
    throw new Error(`Task id must be a ClickUp custom id (e.g. 86d3zc5af), got: ${taskId}`);
  }
}

export function assertSlug(slug) {
  if (typeof slug !== 'string' || slug.length === 0) {
    throw new Error('Slug is required (kebab-case ticket title).');
  }
  if (!SLUG.test(slug)) {
    throw new Error(`Slug must be kebab-case (a-z0-9 and hyphens), got: ${slug}`);
  }
  if (SLUG_PREFIX.test(slug)) {
    throw new Error(`Slug must not start with a branch prefix, got: ${slug}`);
  }
}

export function folderName(taskId, slug) {
  assertTaskId(taskId);
  assertSlug(slug);
  return `${taskId}-${slug}`;
}

export function branchName({ taskId, slug, hotfix = false } = {}) {
  const folder = folderName(taskId, slug);
  return `${hotfix ? 'hotfix' : 'feature'}/${folder}`;
}

export function mainRepoFromGitCommonDir(gitCommonDir) {
  if (typeof gitCommonDir !== 'string' || gitCommonDir.length === 0) {
    throw new Error('gitCommonDir is required.');
  }
  const resolved = path.resolve(gitCommonDir);
  if (path.basename(resolved) === '.git') {
    return path.dirname(resolved);
  }
  throw new Error(`git-common-dir should end with .git, got: ${gitCommonDir}`);
}

export function workspaceRootFromRepo(repoRoot) {
  if (typeof repoRoot !== 'string' || repoRoot.length === 0) {
    throw new Error('repoRoot is required.');
  }
  return path.dirname(path.resolve(repoRoot));
}

export function worktreePath({ repoRoot, taskId, slug } = {}) {
  return path.join(workspaceRootFromRepo(repoRoot), 'worktrees', folderName(taskId, slug));
}

function parseArgs(argv) {
  const out = { hotfix: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--hotfix') {
      out.hotfix = true;
      continue;
    }
    if (arg === '--repo' || arg === '--taskId' || arg === '--slug') {
      out[arg.slice(2)] = argv[i + 1];
      i += 1;
    }
  }
  return out;
}

function main(argv) {
  const args = parseArgs(argv);
  if (!args.repo || !args.taskId || !args.slug) {
    throw new Error(
      'Usage: node scripts/worktree-paths.mjs --repo <path> --taskId <id> --slug <kebab> [--hotfix]',
    );
  }
  const payload = {
    branch: branchName({ taskId: args.taskId, slug: args.slug, hotfix: args.hotfix }),
    folder: folderName(args.taskId, args.slug),
    workspaceRoot: workspaceRootFromRepo(args.repo),
    worktreePath: worktreePath({
      repoRoot: args.repo,
      taskId: args.taskId,
      slug: args.slug,
    }),
  };
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

const invokedDirectly =
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
