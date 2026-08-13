---
name: Task-Driven Development
description: Work through GitHub issues one at a time with dependency checks, scoped staging, and review-ready commit messages. Use when the user asks to work on issues from GitHub, a todo list, backlog folder, or workflow document.
tags: [operations, tasks, workflow, github, git]
audience: [engineers, tech-leads, all]
status: stable
---

# Task-Driven Development

Use this skill when implementing work from GitHub Issues or a workflow document. Follow
[`docs/github-source-of-truth.md`](../../../docs/github-source-of-truth.md) — the authoritative
policy for how engineering work is identified, sequenced, and executed. This skill applies that
policy to the per-issue implementation loop; it does not restate the policy.

## Issue and chat titles

- When talking about issues (chat, plans, PR/issue comments, summaries), use the **issue title**, not the raw issue number, as the primary label.
- Numbers are fine in URLs, branch names (`<type>/<issue-number>-<kebab-title>`), and as a secondary reference after the title.
- When picking up an issue, set the Cursor **chat title** to that issue's title.

## Out of scope → follow-up issues

When planning an issue, every **Out of scope** item that is real follow-up work must have a GitHub issue. Emit a **Pending / out-of-scope backlog** table (Title, Depends on, Notes), then file each missing row:

1. Search existing issues by title/intent first (`gh issue list --search "<keywords>"`) — do not invent duplicates.
2. Create missing issues with acceptance criteria: `gh issue create --title "..." --body "..."`.
3. Wire dependency by adding a `Depends on: #<parent>` (and, on the parent, `Blocks: #<new>`) line to the issue body — see `docs/github-source-of-truth.md` section 5.
4. Leave new backlog issues **unassigned**; do not self-assign an issue you are not about to implement (browse/file ≠ claim).
5. Mention new issue numbers on the parent issue/PR description (a comment is fine, but prefer linking rather than a comment dump).

See also `backlog-refinement`.

## Core rules

1. Gather context first:
   - Read the workflow or reference document.
   - List the relevant issues and their state (open/closed, labels, `Depends on`).
   - Read the selected issue's full body and comments before editing files.
   - Inspect repo conventions and existing implementation patterns.
   - Create the issue worktree with `pnpm worktree:add` (see `AGENTS.md` / `agent-orchestration`).

2. Work one issue at a time:
   - Keep each implementation scoped to one issue.
   - Do not mix files for different issues in the same staged set.
   - Do not start the next issue until the current one is staged and summarized.

3. Readiness and claiming:
   - An issue is **agent-ready** only when it meets `docs/github-source-of-truth.md` section 4 (clear
     goal, scope, testable acceptance criteria, stated constraints, and — critically — **no
     unresolved `Depends on`**, section 5). Verify readiness from the issue body alone; do not guess.
   - **Claim before plan/implement** (including Plan mode when asked to pick up an issue):
     1. `gh issue view <n> --json assignees,state,body,labels` — confirm it is open, agent-ready,
        and has no unresolved `Depends on`.
     2. Check nobody else already owns it: no existing assignee actively working it, and no open
        PR already declares `Closes #<n>` (`gh pr list --search "linked:<n>"` or
        `gh pr list --search "in:body #<n>"`). If one exists, do not start a second PR — see
        `pr-agent-wake` instead.
     3. Self-assign as the claim signal: `gh issue edit <n> --add-assignee @me` (or the
        equivalent for the current agent identity).
     4. Only then create the branch/worktree from `origin/main` and implement.
   - There is no separate "in progress" status field to set — the self-assignment plus the
     branch/PR *is* the claim. If a claimed issue shows no branch/PR activity for an
     unreasonably long time, a human or orchestrator may unassign it and treat it as available
     again; agents must not unassign another session's issue unless the user asks.
   - **Handoff:** open (or update) the PR with `Closes #<n>` in the body. That is the entire
     handoff — merging the PR closes the issue automatically. There is no separate status
     transition to perform.
   - **Automated review:** Cursor Bugbot, ChatGPT Codex Connector, and similar GitHub bots review
     the PR once it's open. Agents must not pick up another agent's open PR to review it — that is
     the bots' and humans' job. Agents may address bot or human feedback on their own PR directly
     (see `fix-bugbot` for someone else waking you to fix a specific finding).
   - **Steward:** when asked to check open PRs, re-poll mergeable state / required CI / new
     comments for each. Push a fix or reply directly on the PR when actionable; there is no
     ClickUp-side bounce to perform.
   - Labels to watch (if the repository defines them via its GitHub Actions/PR hygiene setup):
     `needs-rebase`, `ci-failed`, `has-feedback`. Infra-only preview failures are not code defects
     — note them on the PR, do not treat them as blocking.
   - **Dirty PR / `needs-rebase`:** follow `AGENTS.md`'s "Shared hub files / conflict playbook" section.
     Prefer `git merge origin/main`, then `pnpm resolve:conflicts`. Do not hand-merge
     `pnpm-lock.yaml` or `infra/main.json`. Hand-fix only paths the script lists
     (`infra/main.bicep`, Nest `main.ts` / `app.module.ts`, workflows). After fixing
     `main.bicep`, rebuild JSON with `az bicep build -f infra/main.bicep --outfile infra/main.json`.
   - **Hub ownership:** do not edit `.cursor/skills/**`, root `package.json`,
     `AGENTS.md` / `SETUP.md` / `docs/pr-pipelines.md`, or workflows unless the issue requires it.
     Skills sync = dedicated chore PR only.
   - When the implementation is finished, do **not** close the issue yourself. Opening the PR
     with `Closes #<n>` and letting a human merge is what closes it.
   - If an issue is a duplicate or already delivered by another issue, say so in a comment and
     link the delivering issue/PR; let a human close it (or close it with `state_reason:
     "not_planned"` only when the user explicitly asks you to).

4. Staging and commits:
   - Stage only files changed for the current issue.
   - Do not commit unless the user explicitly asks.
   - Provide a review-ready commit message after staging.
   - Use one issue per commit message.
   - Format/lint gate is **staged files only**: rely on the husky pre-commit hook
     (`lint-staged`), or run `pnpm lint:staged` manually before commit. Do not default to
     full-repo `pnpm format:check` / `pnpm lint` as the agent gate, and never bypass hooks with
     `--no-verify` for format/lint.

5. Human test plan:
   - Every PR must include a **Test plan** written for a human, not just a list of automated
     commands.
   - Explain what changed, where the new or changed behavior can be found, any setup or test
     data required, numbered steps to exercise it, and the expected result for each step.
   - Include preview URLs and the exact page, route, API endpoint, or workflow to inspect when
     available.
   - Add a **Feedback focus** section that tells the human where comments are most useful. State
     explicitly when a change has no user-facing behavior.

6. Commit type selection:
   - Use `feat` for new user-facing behavior, scripts, workflows, or capabilities.
   - Use `fix` for bug fixes.
   - Use `chore` for maintenance, scaffolding, config-only setup, or repository housekeeping.
   - Use `docs` for documentation-only changes.
   - Follow the repository's commit message format and length rules (`git-conventions`).

7. Requirement drift and inconsistencies:
   - If issue text conflicts with user clarification, repo conventions, or existing config names,
     ask the user before expanding scope.
   - Do not implement future-issue behavior just because an issue example implies it. Keep the
     current issue scoped to the clarified work.
   - When the clarified scope differs from the GitHub issue, update the issue body/comment to
     reflect the actual work before final handoff.
   - Call out known mismatches, such as example path names that do not exist in config, in the
     final summary or as a question for the user.

## End-of-task response

When an issue is implemented and staged, report:

```text
Completed #<issue-number>: [issue title]

Staged files:
- path/to/file
- path/to/other-file

Verified:
- command that passed

Human test plan:
1. Where to find the change and what to do
   Expected: observable result

Feedback focus:
- area where human comments are most useful

Proposed commit message:
type: #<issue-number> Summary

Status:
PR is open with `Closes #<issue-number>`; ready for review.
```

Only say the issue is complete when the PR has actually merged (which closes it).

## Moving to the next task

When the user says "next", "next task", or similar:

1. If the previous issue's PR is open and ready, leave it open — do not close it yourself.
2. Verify the next issue is agent-ready and has no unresolved `Depends on` (sections 4-5).
3. Claim it (self-assign, confirm no existing PR/assignee owns it), then create its worktree from
   `origin/main`.
4. Only after a successful claim, read details, implement, verify, and stage.
5. Leave the issue's PR open until the user asks to merge or move on again.
