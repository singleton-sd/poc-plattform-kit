---
name: Idea to Delivery
description: Turn a refined product or engineering idea into a ClickUp Epic, implementation-ready delivery slices, dependencies, parallel lanes, and human-operation tasks for poc-plattform-kit.
tags: [product, planning, clickup, agents, workflow]
audience: [product-managers, engineers, tech-leads, all]
status: stable
---

# Idea to Delivery

Use this skill when a **Requirements Discovery Brief** is
`READY FOR DESIGN / DELIVERY PLANNING` (or the user already has an
equally decision-complete brief) and they want executable ClickUp work.

Do **not** use this skill to reshape the product idea or invent behavior:

- unstable premise, users, or value → `refine-idea`
- blocking behavioral/business questions → `discover-requirements`
- one existing Delivery ticket that only needs acceptance criteria →
  `backlog-refinement`

UX/UI or architecture **solution** design that is still missing: stop and
ask the user. Do not invent screens, schemas, or infra, and do not call a
design skill that is not in `.cursor/skills/`.

## ClickUp topology

For `singleton-sd/poc-plattform-kit` use the existing Plattform Kit folder and exactly these workflow lists:

- **Ideas & Discovery** — `901616397764`: raw ideas, discovery, spikes, unresolved architecture/design questions.
- **Delivery** — `901616287298`: approved implementation work that can be claimed and delivered by engineering agents.
- **Human & Operations** — `901616397767`: manual gates such as portal setup, approvals, service/account configuration, billing/purchasing, human-entered secrets, or production validation that cannot be completed autonomously.

Do not create lists by technical area or pillar. Web/API/Marketing/Infrastructure and Tenant/Permissions/Notifications/etc. are classifications, not queues.

## Planning hierarchy

Use the smallest hierarchy that preserves intent:

- Tiny isolated change: one Delivery task.
- Medium feature: one Epic/initiative task plus roughly 2–5 independently deliverable tasks.
- Large or cross-cutting feature: Discovery first, then an Epic/initiative plus delivery slices and explicit human-operation tasks.

Default rule: **one independently mergeable PR = one Delivery task**. Do not split work merely by file or layer when the pieces cannot be meaningfully merged/tested independently.

## Epic contract

An Epic/initiative describes the outcome and coordination boundary, not a giant implementation ticket. Include:

- Goal / user outcome
- Why now / context
- Chosen architecture or link to the Architecture Doc
- Scope and explicit non-goals
- Success criteria
- Delivery slices by title
- Human/operations gates
- Dependency graph
- Parallel execution lanes
- Rollout / preview strategy
- Completion rule: all required child/slice work and human gates are complete

Prefer ClickUp parent/subtask relationships when practical; otherwise every child must link the Epic title/URL in its description.

## Delivery task contract

Every agent-ready Delivery task must include:

1. Goal
2. Context
3. Scope
4. Acceptance criteria that are observable/testable
5. Technical direction and relevant repository paths when known
6. Out of scope
7. Dependencies by ticket title
8. Preview/seed scenario expectations when user-facing or bug-reproduction work is involved
9. Automated test expectations
10. Human test plan expectations
11. Parent Epic/initiative reference

A task may enter **READY FOR AI** only when there are no unresolved product/architecture questions that would force the implementer to redesign the feature.

## Classification taxonomy

Classify every task using the dedicated ClickUp custom fields below. Use the field IDs when creating/updating tasks programmatically; keep the human-readable labels in ticket prose only when they improve readability.

| Field | ID |
| --- | --- |
| Area | `d046262e-bc5e-4e51-a13b-2ec91590f08e` |
| Pillar | `63c6b89a-5c01-4ddf-90c3-c1ad7b6df60f` |
| Work Type | `e7d43240-fe4a-4a62-8806-75a5b7f66ac7` |
| Execution | `37574c9a-004c-419e-b1c1-5ac6f47fc501` |

### Area

Choose one primary value:

- Web App
- API
- Marketing
- Infrastructure
- Developer Experience
- Cross-cutting

### Pillar

Choose the owning domain capability when applicable:

- Tenant
- SingleSignOn
- Subscriptions
- Contact
- Support
- Audit
- Reporting
- Permissions
- Notifications
- Platform
- None

### Work Type

- Feature
- Bug
- Technical Debt
- Discovery
- Infrastructure
- Documentation
- Human Action

### Execution

- AI
- Human
- AI + Human

Do not use tags as a substitute for Area/Pillar/Work Type/Execution. Reserve tags for exceptional cross-cutting attributes such as `security`, `ux`, `technical-debt`, `breaking-change`, `cost`, `needs-decision`, and `preview-required` when those tags exist in the space.

## Status semantics

For **Delivery**:

- **BACKLOG** — captured but not yet approved/refined.
- **TO DO** — retained for compatibility; prefer BACKLOG or READY FOR AI for new work.
- **READY FOR AI** — fully refined, dependency-safe implementation work available to agents.
- **IN PROGRESS** — actively claimed by an implementation agent.
- **READY FOR REVIEW** — implementation and PR hygiene complete; automated/human review can happen.
- **READY FOR HUMAN** — AI review + PR hygiene passed; waiting for human merge / final approval.
- **COMPLETE** — merged/delivered and required gates are satisfied.

Never use READY FOR HUMAN as a general storage place for manual tasks. Standalone manual work belongs in **Human & Operations**; READY FOR HUMAN is a Delivery handoff state after review, not a manual-work queue.

**Ideas & Discovery** and **Human & Operations** only have `TO DO`, `IN PROGRESS`, and `COMPLETE`. Do not invent Delivery statuses (`READY FOR AI`, `READY FOR REVIEW`, `READY FOR HUMAN`, `BACKLOG`) on those lists.

## Discovery-to-delivery flow

1. Consume the `refine-idea` brief and `discover-requirements` brief (or
   send the work back if either is missing or blocking).
2. Inspect existing ClickUp tasks and repository architecture to avoid duplicates or contradictory work.
3. Identify unresolved decisions. Keep the work in Ideas & Discovery while material decisions remain.
4. For architecture/cross-cutting changes, update the ClickUp Architecture Doc before or with ticket creation.
5. Define the Epic/initiative outcome.
6. Slice work into independently mergeable/testable Delivery tasks.
7. Create separate Human & Operations tasks for true manual gates.
8. Wire dependencies explicitly.
9. Produce parallel lanes. A lane is sequential internally; independent lanes may be run by separate agents concurrently.
10. Mark only dependency-safe, fully refined implementation tasks READY FOR AI.
11. Provide an agent kickoff prompt that tells agents to claim READY FOR AI tasks, respect dependencies, use one branch/PR per ticket, and follow `AGENTS.md` + `task-driven-development`.

## Parallel-plan output

Finish feature planning with a compact plan like:

```text
Epic: <title>

Lane A — foundation
1. <task>
2. <task>

Lane B — independent UI/API/etc.
1. <task>

Human gates
- <manual task> — required before/after <task>

Join
- <final integration task> waits on Lane A + Lane B + required human gate
```

Do not claim tickets while planning. Browse/refinement is not implementation.

`AGENTS.md` is authoritative for list IDs. Create examples:

```powershell
powershell -File scripts/clickup.ps1 create -Name "..." -Status "BACKLOG" -Description "..." -Estimate 50000
powershell -File scripts/clickup.ps1 create -ListId 901616397764 -Name "..." -Status "TO DO" -Description "..."
powershell -File scripts/clickup.ps1 create -ListId 901616397767 -Name "..." -Status "TO DO" -Description "..."
powershell -File scripts/clickup.ps1 depend -TaskId <child> -DependsOn <parent>
```

```bash
./scripts/clickup.sh create "..." "BACKLOG" 50000
./scripts/clickup.sh create "..." "TO DO" --list-id 901616397764
./scripts/clickup.sh create "..." "TO DO" --list-id 901616397767
./scripts/clickup.sh depend <childId> <parentId>
```

Preserve `FR-nn` / `BR-nn` / `NFR-nn` IDs from `discover-requirements`. Do
not silently change product requirements. After slices exist, run
`backlog-refinement` on any Delivery ticket that is not yet agent-ready.

Do not duplicate `refine-idea`, `discover-requirements`, or
`backlog-refinement`.
