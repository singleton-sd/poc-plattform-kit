---
name: PR Agent Wake
description: Fix an existing PR after ci-failed or has-feedback. Attach to the PR branch; never open a second PR.
tags: [operations, github, pull-requests, automations]
audience: [engineers, agents]
status: stable
---

# PR Agent Wake

Use this skill when a Cursor Automation (or a human) wakes you because a
pull request in `singleton-sd/poc-plattform-kit` got `ci-failed`,
`has-feedback`, or a review comment. You are a **fixer**, not a new
implementer.

Read [`docs/github-source-of-truth.md`](../../../docs/github-source-of-truth.md),
`AGENTS.md` § Shared hub files / conflict playbook, and
`.cursor/skills/agent-orchestration/SKILL.md`, before you touch git.

**Depends on Wave 1** (`Cut PR hygiene noise and add Human Review Brief`,
PR #153) being on `main`. That PR adds `scripts/upsert-pr-review-brief.mjs`
and the `preview-blocked` label. If the brief script is missing, skip the
brief upsert, note that Wave 1 has not merged, and continue the code fix.

## Hard rules

1. Attach to the **existing PR head branch** in your own worktree.
   Never create a new branch from `origin/main`. Never open a second PR.
2. One worktree per PR. Do not share a dirty checkout with another agent.
3. **Check for a concurrent fixer before pushing.** There is no claim lock
   for PRs — check the PR's recent commits and comments instead: if the
   most recent commit was pushed within the last few minutes by another
   automated identity, or another agent has already left an "picking this
   up" style comment more recent than the event that woke you, stand down
   — leave a short comment noting another session already appears active
   and exit without pushing. Otherwise, leave a brief comment noting you're
   picking up the triggering event before you start, so a concurrent wake
   can see you're active.
4. Ignore your own comments and `github-actions[bot]` hygiene/brief
   markers (`<!-- pr-hygiene: -->`, `<!-- pr-review-brief -->`).
5. Ignore reviewer usage-limit comments. They are not feedback.
6. `preview-blocked` is infra (SWA / ACA / Chromatic). Document it on
   the brief. Do not treat it as a code defect — no status change needed.
7. Auto-fix + push + threaded reply when the comment is actionable.
   Design questions get a reply only.
8. Never approve or merge. Never self-review.
9. Refresh from `origin/main` before a completed push using the
   `AGENTS.md` / agent-orchestration playbook (merge-first when
   hub/generated files conflict). `--force-with-lease` only after a
   rebase. Never plain `--force`.
10. Upsert the Human Review Brief
    (`node scripts/upsert-pr-review-brief.mjs --pr <n>`) when that
    script exists on the checkout. No separate handoff step is needed —
    the PR already links its issue with `Closes #N`; merging it closes
    the issue.
11. Remove the worktree when the run finishes or the PR merges.

## How to attach

Delta vs implementer work: attach to the **existing PR head**, do not
branch from `main`, do not open a second PR. Fetch / refresh /
`--force-with-lease` / never-merge follow `AGENTS.md` and
`.cursor/skills/agent-orchestration/SKILL.md`.

```text
1. Identify the PR number and head branch (gh pr view).
2. Fetch origin.
3. git worktree add .worktrees/<pr>-<branch> origin/<head-branch>
   (or the existing local branch). Do not branch from main.
4. Note the issue number the PR closes (from its `Closes #N` body line
   or the branch name `<type>/<issue-number>-<slug>`) for context.
5. Check for a concurrent fixer (Hard rule 3). If another session is
   active, comment and exit.
6. Read the triggering comment / failing required CI logs.
7. Fix on this branch. Reply in the thread when you address a comment.
8. Fetch origin. Merge origin/main when the hub playbook applies.
9. Push the same branch. Upsert the brief if the script exists.
```

Required CI is lint/test/build only. After Wave 1 is on `main`, the
canonical names live in `scripts/upsert-pr-review-brief.mjs` (`requiredCi`)
and `scripts/pr-handoff-gate.mjs` (`expectedChecks`) — do not treat this
skill as a second copy. Preview/Chromatic red is not a fixer wake signal.

## Concurrent-fixer rule

If another automated session already appears active on this PR (Hard rule 3):

- Do not push.
- Comment noting another session appears active and what woke you (new
  CI failure / new comment), so a human can check if the other session
  stalled.
- Exit.

## Automation prompt (copy-paste)

Paste the block below into the single Cursor Automation for this repo.
Create **one** automation, not two. Tools: repository + Comment on pull
request. Do **not** enable approve or merge.

Canonical git rules live in `AGENTS.md`,
`docs/github-source-of-truth.md`, and
`.cursor/skills/agent-orchestration/SKILL.md`. The block below is the
standalone snapshot the automation must paste; keep it in sync with those
files when they change.

```text
You are the PR fixer for singleton-sd/poc-plattform-kit.
Follow .cursor/skills/pr-agent-wake/SKILL.md, AGENTS.md,
docs/github-source-of-truth.md, and
.cursor/skills/agent-orchestration/SKILL.md.

You woke because this pull request was labeled ci-failed or
has-feedback, or received a review comment.

Repository workflow
1. Never work directly on main.
2. Fetch origin before starting.
3. Worktree the existing PR head branch. Do not branch from main.
   Do not open a second PR.
4. Do not incorporate another agent's branch.
5. Before pushing completed work: fetch origin; refresh from
   origin/main per AGENTS.md (merge-first for hub/generated conflicts);
   run the relevant tests.
6. Push --force-with-lease only after a rebase. Never plain --force.
7. Upsert the Human Review Brief when
   scripts/upsert-pr-review-brief.mjs exists. No separate handoff step
   is needed — the PR's `Closes #N` line closes the issue on merge.
8. Refresh again only when mergeability, required CI, or overlap
   with a newly merged PR requires it.
9. Never merge your own PR.
10. Remove the worktree when the run finishes or the PR merges.

There is no claim lock for PRs. Before pushing, check the PR's recent
commits/comments for a concurrent fixer (see "Concurrent-fixer rule" in
the skill) — if one appears active, comment and exit instead of pushing.

Ignore your own comments, github-actions[bot], <!-- pr-hygiene: -->,
<!-- pr-review-brief -->, and reviewer usage-limit comments.
preview-blocked is infra — note it on the brief; do not treat it as a
code defect.

Fix actionable CI or review comments on this branch. Reply in the
thread. Design questions get a reply only. Never approve or merge.
```

## Human setup

One automation at https://cursor.com/automations for this repo:

| Field | Value |
| --- | --- |
| Name | PR fixer |
| Triggers | label `ci-failed` added; label `has-feedback` added; PR review comment |
| Tools | repo + Comment on pull request (no approve / merge) |
| Scope | Members can view (so teammate/bot labels still wake it) |
| Prompt | the copy-paste block above |

Confirm a test run on a labeled PR attaches to that PR branch and
stands down cleanly when another session already appears active.
