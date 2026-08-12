---
name: Task-Driven Development
description: Work through project-management tasks one at a time with status updates, scoped staging, and review-ready commit messages. Use when the user asks to work on tasks from ClickUp, a todo list, backlog folder, workflow document, or project-management board.
tags: [operations, tasks, workflow, clickup, git]
audience: [engineers, tech-leads, all]
status: stable
---

# Task-Driven Development

Use this skill when implementing work from a project-management list or workflow document.

## Ticket and chat titles

- When talking about tickets (chat, plans, PR/ClickUp comments, summaries), use the **ticket title**, not the raw ClickUp id as the primary label.
- Ids are fine in URLs, branch names (`feature/<id>-<kebab-title>`), and as a secondary reference after the title.
- When picking up a ticket, set the Cursor **chat title** to that ticket’s title.

## Out of scope → backlog tickets

When planning a ticket, every **Out of scope** item that is real follow-up work must have a ClickUp task. Emit a **Pending / out-of-scope backlog** table (Title, Depends on, Token Estimate, Notes), then file each missing row:

1. Search the ops list (`list_id=901616287298`) by **title** / intent — do not invent duplicates.
2. Create missing tasks in **TO DO** with acceptance criteria.
3. Set **Token Estimate** on create (`custom_fields` id `ab22f8d4-df04-435e-849a-9ca6c23489be`, value as a number string). Leave Token Spent, Claim token, and Preview URL empty.
4. Wire dependency: `powershell -File scripts/clickup.ps1 depend -TaskId <new> -DependsOn <parent>` (resolve titles to ids at file time).
5. Leave backlog tickets **unassigned**; do **not** set Claim Token (browse/create ≠ claim).
6. Mention new titles on the parent ticket description / plan (avoid extra ClickUp comment spam when possible).

Token Estimate scale when only a sizing hint exists: XS ≈ 25000 · S ≈ 50000 · M ≈ 100000 · L ≈ 200000 · XL ≈ 400000. See also `backlog-refinement`.

## Core rules

1. Gather context first:
   - Read the workflow or reference document.
   - List the relevant tasks and their statuses.
   - Read the selected task details before editing files.
   - Inspect repo conventions and existing implementation patterns.
   - Create the ticket worktree with `pnpm worktree:add` (see `AGENTS.md`).

2. Work one task at a time:
   - Keep each implementation scoped to one ticket.
   - Do not mix files for different tickets in the same staged set.
   - Do not start the next task until the current task is staged and summarized.

3. Status transitions and exclusive claim (Claim Token):
   - Agents often share one ClickUp identity, so **assignee alone is not a
     lock**. Follow `AGENTS.md` § **Exclusive claim protocol**.
   - **ClickUp transport:** use `scripts/clickup.ps1` (Windows) or
     `scripts/clickup.sh` (Linux/Cloud) with `CLICKUP_API_TOKEN` — **not**
     ClickUp MCP (MCP rate-limits easily). Custom fields via field endpoints.
   - **Claim Token** field id (ops list): `50a8d70c-e3a6-4bd7-8e3d-7661eaf6e6c7`
     (also listed in `AGENTS.md` with Preview URL / Token Estimate / Token Spent).
   - **Browse ≠ claim.** Listing or reading tickets must not set Claim Token,
     assignee, or status.
   - **Claim before plan/implement** (including Plan mode when asked to
     pick up a task):
     1. `scripts/clickup.ps1 list -Status "READY FOR AI"`.
     2. `claimToken` = chat/session id or `agent-<uuid>`.
     3. `scripts/clickup.ps1 claim -TaskId <id> -ClaimToken <claimToken>
        -Status "IN PROGRESS"` (implementers; Claim Token only by default —
        add `-AssignMe` only when an owner must show).
     4. On claim race error, abort and pick another ticket.
     5. Only then read details and implement.
   - **Handoff:** `scripts/clickup.ps1 status -TaskId <id> -Status "…"
     -ClearClaim`. Prefer `preview -Url <pr>` over a comment when the only
     payload is the PR link. Set Token Spent via `field` when finishing.
   - **Implementer:** claim → implement → PR → watch required CI → upsert
     the Human Review Brief (`node scripts/upsert-pr-review-brief.mjs --pr <n>`)
     → `clickup.sh handoff` → **READY FOR REVIEW**. Do not post hygiene/status
     comments.
   - **Automated review:** Cursor Bugbot, ChatGPT Codex Connector, and similar
     GitHub bots review the PR after handoff. Agents must not pick up
     **READY FOR REVIEW** tickets to review another agent's work. Agents may
     address bot or human feedback only after the ticket returns to
     **READY FOR AI**.
   - **Steward:** When asked to check open PRs after READY FOR HUMAN, re-poll
     mergeable / CI / new comments; bounce to READY FOR AI (clear Claim
     Token) when agent-fixable. May clear a Claim Token older than ~4h with
     no PR comment; agents must not clear another session’s token unless the
     user asks.
   - Labels to watch: `needs-rebase`, `ci-failed`, `has-feedback` (code).
     `preview-blocked` is infra only — document it on the brief, do not bounce
     ClickUp (see `docs/pr-pipelines.md` / `AGENTS.md` § PR hygiene).
   - **Dirty PR / `needs-rebase`:** follow `AGENTS.md` § **Shared hub files /
     conflict playbook**. Prefer `git merge origin/main`, then
     `pnpm resolve:conflicts`. Do not hand-merge `pnpm-lock.yaml` or
     `infra/main.json`. Hand-fix only paths the script lists
     (`infra/main.bicep`, Nest `main.ts` / `app.module.ts`, workflows).
     After fixing `main.bicep`, rebuild JSON with
     `az bicep build -f infra/main.bicep --outfile infra/main.json`.
   - **Hub ownership:** do not edit `.cursor/skills/**`, root `package.json`,
     `AGENTS.md` / `SETUP.md` / `docs/pr-pipelines.md`, or workflows unless
     the ticket requires it. Skills sync = dedicated chore PR only.
   - When the task implementation is finished, do **not** mark it complete yet.
   - Mark a finished task complete only when the user explicitly asks, or when the user says to move to the next task.
   - If a requested status is rejected, inspect valid task/list statuses and use the closest valid equivalent.
   - If a task is duplicate or already delivered by another task, use the
     list's `cancelled` status when it exists. In ClickUp this may be a
     terminal/done status rather than an open status.
   - For duplicate or covered work, prefer the native `Delivered by` custom
     field over a generic task link when that field exists. Verify with
     `scripts/clickup.ps1 get -TaskId <id>` that the field value points to
     the delivering task.

4. Staging and commits:
   - Stage only files changed for the current task.
   - Do not commit unless the user explicitly asks.
   - Provide a review-ready commit message after staging.
   - Use one ticket per commit message.
   - Format/lint gate is **staged files only**: rely on the husky pre-commit
     hook (`lint-staged`), or run `pnpm lint:staged` manually before commit.
     Do not default to full-repo `pnpm format:check` / `pnpm lint` as the
     agent gate, and never bypass hooks with `--no-verify` for format/lint.

5. Human test plan:
   - Every PR must include a **Test plan** written for a human, not just a list
     of automated commands.
   - Explain what changed, where the new or changed behavior can be found,
     any setup or test data required, numbered steps to exercise it, and the
     expected result for each step.
   - Include preview URLs and the exact page, route, API endpoint, or workflow
     to inspect when available.
   - Add a **Feedback focus** section that tells the human where comments are
     most useful. State explicitly when a change has no user-facing behavior.

6. Commit type selection:
   - Use `feat` for new user-facing behavior, scripts, workflows, or capabilities.
   - Use `fix` for bug fixes.
   - Use `chore` for maintenance, scaffolding, config-only setup, or repository housekeeping.
   - Use `docs` for documentation-only changes.
   - Follow the repository's commit message format and length rules.

7. Requirement drift and inconsistencies:
   - If task text conflicts with user clarification, repo conventions, or
     existing config names, ask the user before expanding scope.
   - Do not implement future-ticket behavior just because a ticket example
     implies it. Keep the current ticket scoped to the clarified work.
   - When the clarified scope differs from the project-management task,
     update the task description to reflect the actual work before final
     handoff.
   - Call out known mismatches, such as example path names that do not exist
     in config, in the final summary or as a question for the user.

## End-of-task response

When a task is implemented and staged, report:

```text
Completed [TICKET-ID]: [task name]

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
type: Summary TICKET-ID

Status:
Task is ready for review and still in progress.
```

Only say the task is complete if the project-management status was actually updated to a completed/closed status.

## Moving to the next task

When the user says "next", "next task", or similar:

1. Mark the previous staged task complete if it was finished and the user is moving on.
2. Clear Claim Token on the previous task if handoff status requires it.
3. Run the exclusive claim protocol on the next **READY FOR AI** task (Claim
   Token + assignee + **IN PROGRESS**, then re-fetch verify).
4. Only after a successful claim, read details, implement, verify, and stage.
5. Leave the task in progress until the user asks to complete it or move on again.
