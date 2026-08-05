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
2. Create missing tasks in **TO DO** with `[repo=singleton-sd/poc-plattform-kit]`, acceptance criteria, and a dependency note naming the parent **by title**.
3. Set **Token Estimate** on create (`custom_fields` id `ab22f8d4-df04-435e-849a-9ca6c23489be`, value as a number string). Leave Token Spent, Claim token, and Preview URL empty.
4. Call `clickup_add_task_dependency` with `type: "waiting_on"` so the new task waits on the parent or named blocker (resolve titles to ids at file time).
5. Leave backlog tickets **unassigned**; do **not** set Claim Token (browse/create ≠ claim).
6. Comment or link the new titles on the parent ticket / plan.

Token Estimate scale when only a sizing hint exists: XS ≈ 25000 · S ≈ 50000 · M ≈ 100000 · L ≈ 200000 · XL ≈ 400000. See also `backlog-refinement`.

## Core rules

1. Gather context first:
   - Read the workflow or reference document.
   - List the relevant tasks and their statuses.
   - Read the selected task details before editing files.
   - Inspect repo conventions and existing implementation patterns.

2. Work one task at a time:
   - Keep each implementation scoped to one ticket.
   - Do not mix files for different tickets in the same staged set.
   - Do not start the next task until the current task is staged and summarized.

3. Status transitions and assignment (claiming work):
   - **Assignment = claiming.** When starting implement or review work, assign
     yourself to the ClickUp task (`assignees: ["me"]` via ClickUp MCP, or
     resolve the current Cursor/ClickUp identity). Do not leave assignee empty.
     Never assign when merely browsing or reading tickets.
   - **Implementer:** On pick-up from **READY FOR AI**, assign self → set
     status **IN PROGRESS** → then implement → open PR → **PR hygiene**
     (CI green + mergeable) → ClickUp comment with PR URL → **READY FOR REVIEW**.
   - **Reviewer:** On pick-up from **READY FOR REVIEW**, assign self as the
     reviewer for the review phase (prefer set assignee to the reviewer). If
     the implementer must remain visible, comment their identity on the ticket
     before/when reassigning. Before **READY FOR HUMAN**, re-check mergeable,
     required CI, and all PR feedback (Bugbot + human issue/review comments).
     On conflict / CI red / actionable feedback → **READY FOR AI** + blockers.
   - **Steward:** When asked to check open PRs after READY FOR HUMAN, re-poll
     mergeable / CI / new comments; bounce to READY FOR AI when agent-fixable.
   - Labels to watch: `needs-rebase`, `ci-failed`, `has-feedback` (see
     `docs/pr-pipelines.md` / `AGENTS.md` § PR hygiene).
   - When starting a task, set that task to `in progress` / **IN PROGRESS**.
   - When the task implementation is finished, do **not** mark it complete yet.
   - Mark a finished task complete only when the user explicitly asks, or when the user says to move to the next task.
   - If a requested status is rejected, inspect valid task/list statuses and use the closest valid equivalent.
   - If a task is duplicate or already delivered by another task, use the
     list's `cancelled` status when it exists. In ClickUp this may be a
     terminal/done status rather than an open status.
   - For duplicate or covered work, prefer the native `Delivered by` custom
     field over a generic task link when that field exists. Verify with
     `clickup_get_task` that the field value points to the delivering task.

4. Staging and commits:
   - Stage only files changed for the current task.
   - Do not commit unless the user explicitly asks.
   - Provide a review-ready commit message after staging.
   - Use one ticket per commit message.

5. Commit type selection:
   - Use `feat` for new user-facing behavior, scripts, workflows, or capabilities.
   - Use `fix` for bug fixes.
   - Use `chore` for maintenance, scaffolding, config-only setup, or repository housekeeping.
   - Use `docs` for documentation-only changes.
   - Follow the repository's commit message format and length rules.

6. Requirement drift and inconsistencies:
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

Proposed commit message:
type: Summary TICKET-ID

Status:
Task is ready for review and still in progress.
```

Only say the task is complete if the project-management status was actually updated to a completed/closed status.

## Moving to the next task

When the user says "next", "next task", or similar:

1. Mark the previous staged task complete if it was finished and the user is moving on.
2. Read the next task details.
3. Assign yourself to the next task (`assignees: ["me"]`) and set it to `in progress` / **IN PROGRESS**.
4. Implement, verify, and stage the files for that task.
5. Leave the task in progress until the user asks to complete it or move on again.
