#!/usr/bin/env bash
# Create an issue worktree beside the clone (Example A parent workspace).
#
# Layout (open the parent folder in Cursor, not the clone):
#   <parent>/repo/                          git clone, stays on main
#   <parent>/worktrees/<id>-<slug>/         this script
#
# GitHub-native usage (default — see AGENTS.md § GitHub-native engineering workflow):
#   ./scripts/add-worktree.sh --issue 174 --type docs --slug github-native-orchestration
#   ./scripts/add-worktree.sh --issue 211 --type fix --slug login-redirect --skip-bootstrap
#
# Legacy ClickUp-tracked ticket usage (kept until docs/github-source-of-truth.md §8-9 migration
# issues land):
#   ./scripts/add-worktree.sh --task-id 86d3zc5af --slug permission-gating
#   ./scripts/add-worktree.sh --task-id 86d3zc5af --slug permission-gating --hotfix --skip-bootstrap

set -euo pipefail

die() { echo "error: $*" >&2; exit 1; }

ISSUE_ID=''
SLUG=''
TYPE=''
HOTFIX=0
SKIP_BOOTSTRAP=0
DRY_RUN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --issue|--task-id) ISSUE_ID="${2:-}"; shift 2 ;;
    --type) TYPE="${2:-}"; shift 2 ;;
    --slug) SLUG="${2:-}"; shift 2 ;;
    --hotfix) HOTFIX=1; shift ;;
    --skip-bootstrap) SKIP_BOOTSTRAP=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    *) die "Unknown argument: $1" ;;
  esac
done

[[ -n "$ISSUE_ID" ]] || die '--issue (or the legacy --task-id) is required'
[[ -n "$SLUG" ]] || die '--slug is required'

GIT_COMMON="$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null)" || die 'Not inside a git repository.'
[[ "$(basename "$GIT_COMMON")" == ".git" ]] || die "git-common-dir should end with .git, got: $GIT_COMMON"
REPO_ROOT="$(cd "$(dirname "$GIT_COMMON")" && pwd)"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

NODE_ARGS=("$SCRIPT_DIR/worktree-paths.mjs" --repo "$REPO_ROOT" --issueId "$ISSUE_ID" --slug "$SLUG")
if [[ -n "$TYPE" ]]; then
  NODE_ARGS+=(--type "$TYPE")
fi
if [[ "$HOTFIX" -eq 1 ]]; then
  NODE_ARGS+=(--hotfix)
fi

JSON="$(node "${NODE_ARGS[@]}")"
BRANCH="$(node -e 'const p=JSON.parse(process.argv[1]); process.stdout.write(p.branch)' "$JSON")"
WT_PATH="$(node -e 'const p=JSON.parse(process.argv[1]); process.stdout.write(p.worktreePath)' "$JSON")"

echo "Branch:   $BRANCH"
echo "Worktree: $WT_PATH"

if [[ "$DRY_RUN" -eq 1 ]]; then
  printf '%s\n' "$JSON"
  exit 0
fi

[[ ! -e "$WT_PATH" ]] || die "Worktree path already exists: $WT_PATH"
mkdir -p "$(dirname "$WT_PATH")"

echo 'Fetching origin/main...'
git fetch origin main

if git show-ref --verify --quiet "refs/heads/$BRANCH" || git show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
  echo "Adding worktree for existing branch $BRANCH"
  git worktree add "$WT_PATH" "$BRANCH"
else
  echo "Creating $BRANCH from origin/main"
  git worktree add -b "$BRANCH" "$WT_PATH" origin/main
fi

if [[ "$SKIP_BOOTSTRAP" -eq 0 ]]; then
  echo 'Bootstrapping worktree dependencies...'
  (cd "$WT_PATH" && pnpm bootstrap:worktree)
fi

echo "Worktree ready: $WT_PATH"
echo 'Open the parent workspace folder in Cursor (the directory that contains repo/ and worktrees/).'
