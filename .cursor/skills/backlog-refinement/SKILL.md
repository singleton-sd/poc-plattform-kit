---
name: Backlog Refinement
description: Refine raw backlog items into well-structured, actionable stories with clear acceptance criteria; file out-of-scope follow-ups as TO DO tickets with Token Estimate and waiting_on dependencies; for architecture/design plans, document decisions in ClickUp before or with ticket creation; refer to tickets by title.
tags: [product, planning, agile, writing, clickup]
audience: [product-managers, engineers, tech-leads]
status: draft
---

# Backlog Refinement

You are a senior product manager and agile practitioner. Given a raw backlog item (a ticket, idea, or rough description), refine it into a well-structured story ready for sprint planning.

## Output for each item

```
Title: <concise action-oriented title>

Type: Feature | Bug | Chore | Spike

User story:
As a [persona], I want [action] so that [outcome].

Context:
<Why this matters, what triggered it, any relevant background>

Acceptance criteria:
- [ ] <specific, testable condition>
- [ ] <specific, testable condition>
- [ ] ...

Out of scope:
- <what this ticket explicitly does not cover>

Pending / out-of-scope backlog:
| Title | Depends on | Token Estimate | Notes |
| --- | --- | --- | --- |
| <action-first sentence case> | <parent or blocker ticket title> | <number> | <one-line why / AC pointer> |

Dependencies:
- <other tickets, systems, or teams this depends on>

Open questions:
- <anything that needs a decision before work can start>

Sizing hint: XS | S | M | L | XL
<brief rationale for the sizing>
```

When producing a Cursor plan or refining a ticket, always include the **Pending / out-of-scope backlog** table for every real follow-up (not permanent non-goals). Columns: **Title**, **Depends on** (ticket **title**), **Token Estimate** (number), **Notes**.

## Rules

- Acceptance criteria must be testable — "system sends an email" not "system handles notifications"
- If the input is a bug, add: **Steps to reproduce**, **Expected behavior**, **Actual behavior**
- If the item is too large to be a single story, split it and output multiple refined items
- Sizing hint is a hint, not a commitment — flag high uncertainty explicitly

## ClickUp documentation (mandatory for architecture / design plans)

When the work is an **architecture**, **design**, or **cross-cutting platform** plan (not a single tiny bugfix), do **not** leave the decision only in chat or a local plan file.

### For `poc-plattform-kit` (locked)

| Concern | Target |
| --- | --- |
| Architecture decisions | [Architecture Doc](https://app.clickup.com/90161394355/docs/2kz0kcnk-1416) (`document_id=2kz0kcnk-1416`) — add or update a page/section |
| Supporting docs | [Docs folder](https://app.clickup.com/90161394355/v/f/901610744236/90165834867) (`folder_id=901610744236`) when a standalone doc is better than an Architecture page |
| Implementation work | Ops/tickets list only: `list_id=901616287298` (workspace `90161394355`) |
| Ticket title tag | Include `[repo=singleton-sd/poc-plattform-kit]` in the task name or description |

### Required steps (planning → ClickUp)

1. **Write the Architecture Doc page** (or update an existing page) with: goal, chosen approach, where to log, alert rules, out of scope, and links to related tickets.
2. **Create ClickUp tasks** in list `901616287298` from the refined stories — one task per delivery slice — status `TO DO` (or `READY FOR AI` if already approved for agents).
3. **Link** each task to the Architecture Doc page (put the doc URL in the task description — avoid extra ClickUp comments when possible).
4. **Repo mirror (optional):** a short `docs/*.md` in git may summarize the same decisions for engineers; **ClickUp Architecture Doc is the source of truth** for platform architecture.

### What counts as “architecture / design”

- New Azure resources, observability, auth, messaging patterns, pillar boundaries, secrets/config layout, CI/CD topology
- Multi-ticket epics that need a shared design before coding

### What does not require a new Architecture page

- Single-file bugfixes already covered by an existing doc section
- Pure chore tickets with no design choice (e.g. bump a patch dependency)

If unsure, add a short section to the Architecture Doc rather than skipping.

## Out of scope → backlog tickets

When planning or refining a ticket, every **Out of scope** item that is real follow-up work (not a permanent non-goal) must become a ClickUp task if one does not already exist:

1. Search the ops list for an equivalent ticket (match by **title** / intent — do not invent duplicates): `powershell -File scripts/clickup.ps1 list` (or search by name in results).
2. If missing, create it: `powershell -File scripts/clickup.ps1 create -Name "..." -Status "TO DO" -Description "..." -Estimate <n>` (ops list `901616287298`).
3. Include clear acceptance criteria in `-Description`.
4. **Token Estimate** is set via `-Estimate` on create (field `ab22f8d4-df04-435e-849a-9ca6c23489be`). Leave **Token Spent**, **Claim Token**, and **Preview URL** empty.
5. After create: `powershell -File scripts/clickup.ps1 depend -TaskId <new> -DependsOn <parent>` so the new task waits on the parent (or named blocker).
6. Leave new backlog tickets **unassigned** and do **not** set Claim Token (browse/create ≠ claim).
7. Prefer linking via dependencies / description over a parent-ticket comment dump (reduces notification noise).

### Token Estimate convention

Map qualitative sizing to a rough token count when only a sizing hint is available:

- XS ≈ 25000 · S ≈ 50000 · M ≈ 100000 · L ≈ 200000 · XL ≈ 400000

Store the number on **Token Estimate**; keep the sizing label in the description if useful.

### Ops list custom fields

| Field | ID | When filing backlog |
| --- | --- | --- |
| Token Estimate | `ab22f8d4-df04-435e-849a-9ca6c23489be` | Set on create |
| Token Spent | `be7b08e9-b094-4578-bd0a-49f20af85f3c` | Leave empty |
| Claim token | `50a8d70c-e3a6-4bd7-8e3d-7661eaf6e6c7` | Do not set |
| Preview URL | `978d43d5-e404-4262-98a2-0193ade4736d` | Leave empty |

## Ticket and chat titles

When talking about tickets (chat, plans, comments, summaries), use the **ticket title**, not the raw ClickUp id as the primary label. Ids may appear in links, branch names (`feature/<id>-<kebab-title>`), or after the title when needed. When picking up a ticket, set the Cursor **chat title** to that ticket’s title.
