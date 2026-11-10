#!/usr/bin/env bash
# Delete marketing GitHub Pages PR preview leftovers that are not tied to an
# open pull request (gh-pages pr-preview/pr-<n>/).
#
# Does not touch Azure product-app SWA / ACA previews — see
# sweep-preview-orphans.sh.
#
# Requires: gh, git.
# Usage:
#   ./scripts/sweep-pages-preview-orphans.sh
#   ./scripts/sweep-pages-preview-orphans.sh --dry-run
#   DRY_RUN=1 ./scripts/sweep-pages-preview-orphans.sh

set -euo pipefail

DRY_RUN="${DRY_RUN:-0}"
PREVIEW_ROOT="pr-preview"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -h | --help)
      sed -n '2,14p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

log() { printf '%s\n' "$*"; }

if ! command -v gh >/dev/null 2>&1; then
  echo "error: gh is required" >&2
  exit 1
fi
if ! command -v git >/dev/null 2>&1; then
  echo "error: git is required" >&2
  exit 1
fi

open_prs_raw=""
if ! open_prs_raw="$(gh pr list --state open --limit 1000 --json number --jq '.[].number')"; then
  echo "error: gh pr list failed — refusing to sweep (open-PR discovery required)" >&2
  exit 1
fi
mapfile -t OPEN_PRS < <(printf '%s\n' "$open_prs_raw" | tr -d '\r' | awk 'NF' | sort -n)
declare -A OPEN_SET=()
for n in "${OPEN_PRS[@]:-}"; do
  [[ -n "$n" ]] && OPEN_SET["$n"]=1
done

if ! git fetch origin gh-pages:gh-pages 2>/dev/null; then
  log "gh-pages branch not found — nothing to sweep"
  exit 0
fi

work="$(mktemp -d)"
cleanup() { git worktree remove --force "$work" >/dev/null 2>&1 || rm -rf "$work"; }
trap cleanup EXIT
git worktree add --detach "$work" gh-pages

if [[ ! -d "$work/$PREVIEW_ROOT" ]]; then
  log "no $PREVIEW_ROOT directory on gh-pages — nothing to sweep"
  exit 0
fi

removed=0
shopt -s nullglob
for dir in "$work/$PREVIEW_ROOT"/pr-*; do
  [[ -d "$dir" ]] || continue
  base="$(basename "$dir")"
  if [[ ! "$base" =~ ^pr-([0-9]+)$ ]]; then
    continue
  fi
  pr="${BASH_REMATCH[1]}"
  if [[ -n "${OPEN_SET[$pr]:-}" ]]; then
    log "keep $PREVIEW_ROOT/$base (PR #$pr is open)"
    continue
  fi
  log "remove $PREVIEW_ROOT/$base (PR #$pr is not open)"
  if [[ "$DRY_RUN" == "1" ]]; then
    log "DRY-RUN: rm -rf $PREVIEW_ROOT/$base"
  else
    rm -rf "$dir"
  fi
  removed=$((removed + 1))
done

if [[ "$DRY_RUN" == "1" ]]; then
  log "DRY-RUN: would remove $removed preview directory(ies)"
  exit 0
fi

git -C "$work" add -A
if git -C "$work" diff --cached --quiet; then
  log "no orphan marketing Pages previews"
  exit 0
fi

git -C "$work" -c user.name="github-actions[bot]" \
  -c user.email="41898282+github-actions[bot]@users.noreply.github.com" \
  commit -m "chore: Sweep orphan marketing Pages previews"
git -C "$work" push origin HEAD:gh-pages
log "removed $removed orphan marketing Pages preview(s)"
