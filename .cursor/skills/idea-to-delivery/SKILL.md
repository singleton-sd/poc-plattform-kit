---
name: Idea to Delivery
description: Turn a refined product or engineering idea into a ClickUp Epic, implementation-ready delivery slices, dependencies, parallel lanes, and human-operation tasks for poc-plattform-kit.
tags: [product, planning, clickup, agents, workflow]
audience: [product-managers, engineers, tech-leads, all]
status: stable
---

# Idea to Delivery

Use this skill when the user develops an idea in chat and wants it converted into executable project work.

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
12. `[repo=singleton-sd/poc-plattform-kit]`

A task may enter **READY FOR AI** only when there are no unresolved product/architecture questions that would force the implementer to redesign the feature.

## Classification taxonomy

When ClickUp fields exist, classify each task with these concepts. Until dedicated fields are available, record them near the top of the description using the exact labels below so they remain machine-readable.

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

1. Capture/refine the idea.
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
