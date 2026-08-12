---
name: Backlog Refinement
description: Refine raw ideas and backlog items into decision-complete work, then route discovery, implementation, and human gates through the poc-plattform-kit ClickUp workflow.
tags: [product, planning, agile, writing, clickup]
audience: [product-managers, engineers, tech-leads]
status: stable
---

# Backlog Refinement

Use this skill to turn a rough idea, bug, feature request, transcript, or existing ticket into work that can be safely executed by humans and AI agents.

For multi-ticket feature planning, also apply `idea-to-delivery`.

## ClickUp routing

For `singleton-sd/poc-plattform-kit`:

- **Ideas & Discovery** (`901616397764`) — unresolved ideas, spikes, design questions and discovery.
- **Delivery** (`901616287298`) — approved implementation work.
- **Human & Operations** (`901616397767`) — standalone manual gates and operational actions.
- **Architecture Doc** (`2kz0kcnk-1416`) — source of truth for architecture/design decisions.

Do not create Web/API/Marketing/pillar-specific lists. Those are task classifications.

## Refinement decision

Classify the input before creating implementation work:

- **Tiny isolated change:** one Delivery task.
- **Medium feature:** Epic/initiative + roughly 2–5 Delivery tasks.
- **Large/cross-cutting or materially uncertain work:** keep/create Discovery work first; once decisions are made, create an Epic/initiative and delivery slices.
- **Manual requirement:** create a Human & Operations task rather than pretending an AI implementer can complete it.

Default slicing rule: one independently mergeable PR is usually one Delivery task.

## Required ticket shape

```text
Title: <concise action-oriented title>

Area: Web App | API | Marketing | Infrastructure | Developer Experience | Cross-cutting
Pillar: Tenant | SingleSignOn | Subscriptions | Contact | Support | Audit | Reporting | Permissions | Notifications | Platform | None
Work Type: Feature | Bug | Technical Debt | Discovery | Infrastructure | Documentation | Human Action
Execution: AI | Human | AI + Human
Parent Epic: <title/link or None>

Goal:
<observable outcome>

Context:
<why this matters>

Scope:
- <included work>

Acceptance criteria:
- [ ] <specific testable condition>

Technical direction:
- <constraints, patterns, likely repo paths>

Preview / seed scenarios:
- <how the feature/bug is demonstrated in PR previews when applicable>

Testing:
- <automated expectations>
- <human validation expectations>

Out of scope:
- <true non-goals>

Dependencies:
- <ticket titles / external gates>

Open questions:
- <must be empty before READY FOR AI unless explicitly safe for implementer choice>

Sizing hint: XS | S | M | L | XL
[repo=singleton-sd/poc-plattform-kit]
```

For bugs also include Steps to reproduce, Expected behavior and Actual behavior.

When filing or updating a task through ClickUp tooling, set Area, Pillar, Work Type, and Execution using the dedicated custom fields listed below. Do not rely on tags or description text as the source of truth for these classifications.

## READY FOR AI gate

A task may be marked **READY FOR AI** only when:

- acceptance criteria are testable;
- material architecture/product decisions are resolved;
- dependencies are complete or explicitly safe to run in parallel;
- the task is independently deliverable;
- repository constraints and relevant paths/patterns are identified when known;
- preview/seed expectations are defined for user-facing changes or reproducible bugs;
- any required manual setup is represented as a Human & Operations task;
- no duplicate/equivalent ticket already owns the work.

Otherwise keep it in BACKLOG/Discovery rather than handing ambiguity to an implementation agent.

## Architecture documentation

For architecture, design, new Azure resources, auth, messaging, pillar boundaries, secrets/config, CI/CD topology, or other cross-cutting plans:

1. Update/add the relevant Architecture Doc page with goal, chosen approach, trade-offs, boundaries, operational implications and links to work.
2. Create the Epic/initiative and implementation slices after the decision is documented.
3. Put the Architecture Doc link in relevant ticket descriptions.
4. A short repo `docs/*.md` mirror is optional; ClickUp Architecture Doc remains the planning source of truth.

## Out-of-scope follow-ups

Every real follow-up discovered during refinement must be represented explicitly rather than hidden in prose.

1. Search existing tasks by title/intent first (no duplicates):
   - Delivery: `powershell -File scripts/clickup.ps1 list` (default `-ListId 901616287298`)
   - Ideas & Discovery: `powershell -File scripts/clickup.ps1 list -ListId 901616397764`
   - Human & Operations: `powershell -File scripts/clickup.ps1 list -ListId 901616397767`
2. If missing, create on the correct list:
   - Discovery: `powershell -File scripts/clickup.ps1 create -ListId 901616397764 -Name "..." -Status "TO DO" -Description "..." -Estimate <n>`
   - Delivery: `powershell -File scripts/clickup.ps1 create -Name "..." -Status "BACKLOG" -Description "..." -Estimate <n>` (omit `-ListId`; default is Delivery)
   - Manual: `powershell -File scripts/clickup.ps1 create -ListId 901616397767 -Name "..." -Status "TO DO" -Description "..." -Estimate <n>`
3. Include clear acceptance criteria in `-Description`.
4. **Token Estimate** is set via `-Estimate` on create (field `ab22f8d4-df04-435e-849a-9ca6c23489be`). Leave **Token Spent**, **Claim Token**, and **Preview URL** empty.
5. After create: `powershell -File scripts/clickup.ps1 depend -TaskId <new> -DependsOn <parent>` so the new task waits on the parent (or named blocker).
6. Leave new backlog tickets **unassigned** and do **not** set Claim Token (browse/create ≠ claim).
7. Prefer linking via dependencies / description over a parent-ticket comment dump.

### Token Estimate convention

Map qualitative sizing to a rough token count when only a sizing hint is available:

- XS ≈ 25000 · S ≈ 50000 · M ≈ 100000 · L ≈ 200000 · XL ≈ 400000

Store the number on **Token Estimate**; keep the sizing label in the description if useful.

### ClickUp custom fields (when filing)

| Field | ID | When filing backlog |
| --- | --- | --- |
| Area | `d046262e-bc5e-4e51-a13b-2ec91590f08e` | Set to the task's primary technical area |
| Pillar | `63c6b89a-5c01-4ddf-90c3-c1ad7b6df60f` | Set to the owning product/domain pillar |
| Work Type | `e7d43240-fe4a-4a62-8806-75a5b7f66ac7` | Set to the task's work classification |
| Execution | `37574c9a-004c-419e-b1c1-5ac6f47fc501` | Set to AI, Human, or AI + Human |
| Token Estimate | `ab22f8d4-df04-435e-849a-9ca6c23489be` | Set on create |
| Token Spent | `be7b08e9-b094-4578-bd0a-49f20af85f3c` | Leave empty |
| Claim Token | `50a8d70c-e3a6-4bd7-8e3d-7661eaf6e6c7` | Do not set |
| Preview URL | `978d43d5-e404-4262-98a2-0193ade4736d` | Leave empty |

## Epic and parallel execution

For medium/large features, finish refinement with:

- Epic/initiative title and outcome;
- child Delivery task titles;
- Human & Operations gates;
- dependency graph;
- parallel lanes;
- join/final integration work;
- explicit list of tasks safe to mark READY FOR AI now.

Do not put every ticket into READY FOR AI at once when dependencies make that unsafe.

## Naming

Use ticket titles as the primary human label. IDs belong in URLs, branch names, dependency wiring and secondary references. Keep task names concise, sentence case and free of repository identifiers or routing markers — put `[repo=singleton-sd/poc-plattform-kit]` in the task description, never in the name.
