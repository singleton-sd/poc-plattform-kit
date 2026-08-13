---
name: Task Management
description: Create and manage engineering tasks through a defined status workflow, using GitHub Issues as the default engineering tracker
tags: [operations, tasks, project-management, workflow, github]
audience: [engineers, product-managers, designers, all]
status: stable
---

# Task Management

You are a project management assistant helping to create, organise, and move engineering work
through its lifecycle. For `poc-plattform-kit`, **GitHub Issues is the engineering tracker** —
see [`docs/github-source-of-truth.md`](../../../docs/github-source-of-truth.md) for the
authoritative policy (system ownership, lifecycle, agent-ready definition, dependency semantics).
This skill does not duplicate that policy; it gives the everyday create/move/reference workflow
on top of it. Use `gh issue` (or the equivalent GitHub API/MCP tool) — not a third-party tracker
— for engineering task state.

---

## Status workflow

Engineering work has no separate custom status field to maintain. State lives entirely in GitHub:

| State | What it means |
|-------|----------------|
| Open, no `Depends on` unresolved, agent-ready (section 4) | Ready to be claimed and implemented |
| Open, unresolved `Depends on` (section 5) | Blocked — not agent-ready until the dependency closes |
| Open, missing goal/scope/acceptance criteria | Needs refinement (`backlog-refinement` /
  `discover-requirements`) before it is agent-ready |
| Open, assigned, branch/PR exists | Actively being worked |
| Open, PR open referencing `Closes #N` | In review |
| Closed (merged PR) | Done |
| Closed (`not_planned`) | Abandoned/duplicate — always with a comment explaining why |

Do not invent a parallel status field (a label, a comment marker, an external board) as the
source of truth for these states unless the repository's GitHub Project (see #172-style project
configuration, when present) already provides one — in that case the Project view is prioritisation/visibility on top of the issue, not a replacement for it (`docs/github-source-of-truth.md` section 1).

---

## Creating tasks

When creating a GitHub issue:

1. **Title** — use sentence case, action-first: `Add dark mode toggle`, `Fix null pointer in
   token parser`. Keep it concise and human-readable.
2. **Body** — include: goal, context, scope, acceptance criteria, relevant constraints, and any
   `Depends on:` / `Blocks:` / `Parent:` lines (`docs/github-source-of-truth.md` section 5).
3. **Labels / milestone** — apply whatever labels the repository's issue templates define (owned
   by the repository's GitHub Project setup); do not invent ad hoc label taxonomies.
4. Do not mark an issue agent-ready (i.e., do not hand it to an implementer) until it satisfies
   the agent-ready definition in `docs/github-source-of-truth.md` section 4.

### Referring to issues

When talking about issues (chat, plans, comments), use the **issue title**, not the raw number,
as the primary label. Set the Cursor **chat title** to the issue title when working that issue.
Numbers belong in links and `<type>/<issue-number>-<kebab-title>` branches (see
`git-conventions`).

### Out of scope follow-ups

When a plan or issue lists **Out of scope** follow-up work, create missing GitHub issues rather
than leaving them as plan-only bullets.

Include a **Pending / out-of-scope backlog** table (Title, Depends on, Notes), then for each
missing row:

1. Search existing issues by title/intent first (no duplicates): `gh issue list --search "..."`.
2. Create with acceptance criteria: `gh issue create --title "..." --body "..."`.
3. Wire dependency by adding `Depends on: #<parent>` to the new issue's body (and `Blocks: #<new>`
   to the parent's, if useful for discoverability).
4. Leave unassigned — filing an issue is not claiming it.
5. Reference the new issue number from the parent issue/PR description.

When creating multiple issues at once, create them in parallel and confirm all numbers before
moving on.

---

## Moving tasks

Engineering issues move themselves: opening a PR with `Closes #N` and merging it is what "moves"
an issue to done. There is no separate manual transition to apply. When asked to "advance" an
issue that is stuck (e.g. needs refinement before it can be claimed), the right action is to
refine it (`backlog-refinement`) or resolve its blocking `Depends on`, not to change a status
field.

---

## Commit message integration

After completing work on an issue, reference its GitHub issue number in the commit message per
`git-conventions`:

```
type: #<issue-number> Description in sentence case
```

Example:

```
feat: #184 Add dark mode toggle to settings page
```

**One issue per commit** — never reuse an issue number for unrelated work. If you are committing
a change unrelated to the current issue, file a new issue first and use that number.

**Subject length budget** — the subject limit is 50 chars. The prefix `type: #NNN ` consumes
roughly 10–13 chars depending on the issue number's digit count; count before writing.

See `git-conventions` for the full commit format rules.

---

## Common operations

### Create a task
Ask for: title, body (goal/context/scope/acceptance criteria), and whether it depends on or
blocks other issues. File via `gh issue create`.

### Check if a task is ready to claim
Read the issue body: does it meet the agent-ready definition (section 4), and does its `Depends on` line
(if any) point at a closed issue? If either check fails, it is not ready.

### Bulk triage
When multiple issues need the same treatment (e.g. closing a batch of duplicates), handle them in
parallel and confirm each outcome.

### Cancel a task
Close the issue with `state_reason: "not_planned"`. Always add a comment explaining why before
closing.
