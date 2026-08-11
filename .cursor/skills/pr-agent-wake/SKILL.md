---
name: PR Agent Wake
description: Fix an existing PR after ci-failed or has-feedback. Attach to the PR branch; never open a second PR.
tags: [operations, github, pull-requests, automations, clickup]
audience: [engineers, agents]
status: stable
---

# PR Agent Wake

Use this skill when a Cursor Automation (or a human) wakes you because a
pull request in `singleton-sd/poc-plattform-kit` got `ci-failed`,
`has-feedback`, or a review comment. You are a **fixer**, not a new
implementer.

Read `AGENTS.md` § Exclusive claim protocol and § Shared hub files /
conflict playbook before you touch git or ClickUp.

## Hard rules

1. Attach to the **existing PR head branch** in your own worktree.
   Never create `feature/<id>` from `origin/main`. Never open a second PR.
2. One worktree per PR. Do not share a dirty checkout with another agent.
3. **Claim Token is the lock.** Claim the linked ClickUp ticket before
   coding. If the ticket is `IN PROGRESS` with a **foreign** Claim Token,
   do not steal it. Upsert the Human Review Brief with
   “CI red / new comment; owner still claimed” and exit.
4. Ignore your own comments and `github-actions[bot]` hygiene/brief
   markers (`<!-- pr-hygiene: -->`, `<!-- pr-review-brief -->`).
5. Ignore reviewer usage-limit comments. They are not feedback.
6. `preview-blocked` is infra (SWA / ACA / Chromatic). Document it on
   the brief. Do not treat it as a code defect and do not bounce ClickUp.
7. Auto-fix + push + threaded reply when the comment is actionable.
   Design questions get a reply only.
8. Never approve or merge. Never self-review.
9. Refresh from `origin/main` before a completed push using the
   `AGENTS.md` playbook (merge-first when hub/generated files conflict).
   Use `--force-with-lease` only after a rebase. Never plain `--force`.
10. Upsert the Human Review Brief
    (`node scripts/upsert-pr-review-brief.mjs --pr <n>`).
    Run `./scripts/clickup.sh handoff` only if **this run** holds the
    Claim Token.
11. Remove the worktree when the run finishes or the PR merges.

## How to attach

```text
1. Identify the PR number and head branch (gh pr view).
2. Fetch origin.
3. git worktree add .worktrees/<pr>-<branch> origin/<head-branch>
   (or the existing local branch). Do not branch from main.
4. Extract the ClickUp id from feature/<id>-… or hotfix/<id>-….
5. Claim: scripts/clickup.ps1 claim -TaskId <id> -ClaimToken <session>
   (Linux: ./scripts/clickup.sh claim <id> <session>).
   If claim refuses a foreign token: update the brief and exit.
6. Read the triggering comment / failing required CI logs.
7. Fix on this branch. Reply in the thread when you address a comment.
8. Fetch origin. Merge origin/main when the hub playbook applies.
9. Push the same branch. Upsert the brief.
10. Handoff only if this session still holds the Claim Token.
```

Required CI is lint/test/build only (`Lint / test / build (api)`,
`Lint / format / build (web)`). Preview/Chromatic red is not a fixer
wake signal.

## Collision rule

If ClickUp is `IN PROGRESS` and Claim Token is nonempty and not yours:

- Do not push.
- Do not claim.
- Upsert the brief: owner still claimed; new CI/comment arrived.
- Exit.

## Automation prompt (copy-paste)

Paste the block below into the single Cursor Automation for this repo.
Create **one** automation, not two. Tools: repository + Comment on pull
request. Do **not** enable approve or merge.

```text
You are the PR fixer for singleton-sd/poc-plattform-kit.
Follow .cursor/skills/pr-agent-wake/SKILL.md and AGENTS.md.

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
7. Open/update the single ticket PR. Upsert the Human Review Brief.
   Complete ClickUp handoff only if this session holds the Claim Token.
8. Refresh again only when mergeability, required CI, or overlap
   with a newly merged PR requires it.
9. Never merge your own PR.
10. Remove the worktree when the run finishes or the PR merges.

Claim Token is the exclusive lock (scripts/clickup.ps1 / clickup.sh).
If the ticket is IN PROGRESS with a foreign Claim Token, only update
the Human Review Brief (“CI red / new comment; owner still claimed”)
and exit.

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
stops if Claim Token is held by another session.
