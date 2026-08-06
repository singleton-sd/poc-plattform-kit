---
name: Task Management
description: Create and manage tasks in a project management tool through a defined status workflow
tags: [operations, tasks, project-management, workflow, ticketing]
audience: [engineers, product-managers, designers, all]
status: stable
---

# Task Management

You are a project management assistant helping to create, organise, and move tasks through the team's status workflow. For `poc-plattform-kit`, use REST via `scripts/clickup.ps1` + `CLICKUP_API_TOKEN` (not ClickUp MCP). Apply these rules when creating tasks, updating statuses, or managing lists.

---

## Status workflow

Tasks move through the following statuses in order:

```
backlog → scoping → ready for development → in design → in development → in review → testing → shipped
```

`cancelled` is available at any point and terminates the task.

| Status | When to use |
|--------|-------------|
| `backlog` | Idea captured, not yet sized or scheduled |
| `scoping` | Being defined — requirements, scope, and acceptance criteria being written |
| `ready for development` | Scoped and approved — ready to be picked up |
| `in design` | UI/UX design work in progress |
| `in development` | Engineering implementation in progress |
| `in review` | PR open or work submitted for peer review |
| `testing` | QA or acceptance testing in progress |
| `shipped` | Deployed and complete — use this, not `complete` (that status does not exist) |
| `cancelled` | Abandoned — leave a comment explaining why before closing |

---

## Creating tasks

When creating a task:

1. **Name** — use sentence case, action-first: `Add dark mode toggle`, `Fix null pointer in token parser`
2. **Description** — include: what needs to be done, why it matters, and any acceptance criteria
3. **List placement** — ask which list/milestone/sprint to place it in if not specified
4. **Status** — default to backlog / not started: on poc-plattform-kit ops list that is **TO DO** (use a list’s literal `BACKLOG` status when it exists)

### Referring to tickets

When talking about tickets (chat, plans, comments), use the **ticket title**, not the raw id as the primary label. Set the Cursor **chat title** to the ticket title when working that ticket. Ids belong in links and `feature/<id>-<kebab-title>` branches.

### Out of scope follow-ups

When a plan or ticket lists **Out of scope** follow-up work, create missing ClickUp tasks in **TO DO** (backlog) on the correct list. Do not leave human/portal/infra follow-ups as plan-only bullets.

Include a **Pending / out-of-scope backlog** table (Title, Depends on, Token Estimate, Notes), then for each missing row on the Platform Kit ops list (`list_id=901616287298`):

1. Search by title/intent first (no duplicates).
2. Create with acceptance criteria.
3. Set **Token Estimate** custom field `ab22f8d4-df04-435e-849a-9ca6c23489be` to the estimate number (string). Leave Token Spent (`be7b08e9-b094-4578-bd0a-49f20af85f3c`), Claim token (`50a8d70c-e3a6-4bd7-8e3d-7661eaf6e6c7`), and Preview URL (`978d43d5-e404-4262-98a2-0193ade4736d`) unset.
4. Wire dependency with `powershell -File scripts/clickup.ps1 depend -TaskId <new> -DependsOn <parent>` so the new task waits on the parent or named blocker.
5. Leave **unassigned**; do not set Claim Token (browse/create ≠ claim).
6. Comment new titles on the parent ticket / plan.

Token Estimate scale: XS ≈ 25000 · S ≈ 50000 · M ≈ 100000 · L ≈ 200000 · XL ≈ 400000.

When creating multiple tasks at once, create them in parallel and confirm all IDs before moving on.

---

## Moving tasks

When asked to advance a task to the next status:

1. Identify the current status
2. Apply the next step in the workflow above
3. Confirm the new status after updating

When moving in bulk, update all tasks in parallel.

---

## Commit message integration

After completing work on a task, reference its ticket ID in the commit message:

```
type: TICKET-ID Description in sentence case
```

Examples:
```
feat: AI-42 Add dark mode toggle to settings page
fix: AI-17 Resolve null pointer in token parser
chore: AI-99 Update dependencies to latest versions
```

**One ticket per commit** — never reuse a ticket ID for a different piece of work. If you are committing a change unrelated to the current ticket, create a new task first and use that ID.

**Subject length budget** — the subject limit is 50 chars. The prefix `type: AI-XX ` already consumes ~12 chars, leaving ~38 for the description. Count before writing.

See `engineering/git-conventions` for the full commit format rules.

---

## Workspace context

| Detail | Value |
|--------|-------|
| Ticket prefix | `AI-` |
| Skills list | AI Plattform → Skills → Skills Product Backlog (ID: `901614473129`) |

When creating a task for a new or updated skill, default to the Skills Product Backlog list.

---

## Common operations

### Create a task
Ask for: name, description (optional), target list. Default status to `backlog`.

### Move a task to the next status
Ask for: task ID or name, confirm the transition before applying.

### Bulk status update
When multiple tasks are done at once (e.g. end of a sprint), update all in parallel.

### Cancel a task
Set status to `cancelled`. Always ask for or provide a cancellation reason — add it as a comment on the task.
