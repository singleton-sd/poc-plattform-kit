---
name: Idea to Delivery
description: Turn a refined product or engineering idea into a GitHub parent/tracking issue, implementation-ready delivery-slice issues, dependencies, and parallel lanes for poc-plattform-kit.
tags: [product, planning, github, agents, workflow]
audience: [product-managers, engineers, tech-leads, all]
status: stable
---

# Idea to Delivery

Use this skill when a **Requirements Discovery Brief** is
`READY FOR DESIGN / DELIVERY PLANNING` (or the user already has an
equally decision-complete brief) and they want executable GitHub issues.

Do **not** use this skill to reshape the product idea or invent behavior:

- unstable premise, users, or value → `refine-idea`
- blocking behavioral/business questions → `discover-requirements`
- one existing issue that only needs acceptance criteria → `backlog-refinement`

UX/UI or architecture **solution** design that is still missing: stop and
ask the user. Do not invent screens, schemas, or infra, and do not call a
design skill that is not in `.cursor/skills/`.

## GitHub topology

For `singleton-sd/poc-plattform-kit`, engineering work is planned and executed as **GitHub
Issues** in this repository — see
[`docs/github-source-of-truth.md`](../../../docs/github-source-of-truth.md) section 1 and section 3. There is
no separate list/queue by technical area or pillar; Area/Pillar/Work Type distinctions (Web App,
API, Marketing, Infrastructure; Tenant, Permissions, Notifications, etc.) belong in the issue body
or in labels defined by the repository's issue templates (see
[#172](https://github.com/singleton-sd/poc-plattform-kit/issues/172)) — not as separate tracking
queues.

## Planning hierarchy

Use the smallest hierarchy that preserves intent:

- Tiny isolated change: one GitHub issue.
- Medium feature: one parent/tracking issue plus roughly 2–5 independently deliverable child
  issues, each declaring `Parent: #<tracking-issue>`.
- Large or cross-cutting feature: a discovery issue first, then a parent/tracking issue plus
  delivery-slice issues and explicit manual/human-only steps called out on the relevant issues.

Default rule: **one independently mergeable PR = one GitHub issue**. Do not split work merely by
file or layer when the pieces cannot be meaningfully merged/tested independently.

## Parent/tracking issue contract

A parent/tracking issue describes the outcome and coordination boundary, not a giant
implementation ticket. Include:

- Goal / user outcome
- Why now / context
- Chosen architecture or link to the Architecture Doc
- Scope and explicit non-goals
- Success criteria
- Child issue titles/numbers (each child declares `Parent: #<this-issue>`)
- Manual/human-only steps called out explicitly
- Dependency graph (`Depends on` / `Blocks` across the children)
- Parallel execution lanes
- Rollout / preview strategy
- Completion rule: all required child issues and manual steps are complete

`docs/github-source-of-truth.md` section 5 gives the canonical example of this pattern (the migration
umbrella issue [#170](https://github.com/singleton-sd/poc-plattform-kit/issues/170) and its
waves).

## Delivery issue contract

Every agent-ready GitHub issue must include:

1. Goal
2. Context
3. Scope
4. Acceptance criteria that are observable/testable
5. Technical direction and relevant repository paths when known
6. Out of scope
7. `Depends on:` / `Blocks:` lines naming other issue numbers
8. Preview/seed scenario expectations when user-facing or bug-reproduction work is involved
9. Automated test expectations
10. Human test plan expectations
11. `Parent: #<tracking-issue>` reference

An issue is agent-ready only when there are no unresolved product/architecture questions that
would force the implementer to redesign the feature, and no unresolved `Depends on`
(`docs/github-source-of-truth.md` section 4).

## Issue state

There is no custom status field to maintain. An issue's state is entirely derived from GitHub:

- **Open, no unresolved `Depends on`, agent-ready** — implementable now.
- **Open, unresolved `Depends on`** — blocked; not agent-ready regardless of how well-specified.
- **Open, assigned / branch or PR exists** — actively being worked.
- **Open, PR open with `Closes #N`** — in review.
- **Closed** — merged and delivered.

Never invent a parallel status label as the source of truth for these states.

## Discovery-to-delivery flow

1. Consume the `refine-idea` brief and `discover-requirements` brief (or send the work back if
   either is missing or blocking).
2. Search existing GitHub issues and inspect repository architecture to avoid duplicates or
   contradictory work (`gh issue list --search "..."`).
3. Identify unresolved decisions. Keep the work as a discovery issue (or issue comment) while
   material decisions remain — do not create delivery-slice issues yet.
4. For architecture/cross-cutting changes, update the Architecture Doc before or alongside issue
   creation (documentation location/ownership is unchanged by this skill).
5. Define the parent/tracking issue's outcome.
6. Slice work into independently mergeable/testable child issues.
7. Call out true manual/human-only gates explicitly on the relevant issue(s) rather than folding
   them into an AI-implementable issue.
8. Wire dependencies explicitly (`Depends on:` / `Blocks:` / `Parent:`).
9. Produce parallel lanes. A lane is sequential internally; independent lanes may be run by
   separate agents concurrently.
10. Mark only dependency-safe, fully refined issues as agent-ready (no unresolved `Depends on`,
    no open blocking questions).
11. Provide an agent kickoff prompt that tells agents to claim agent-ready issues, respect
    `Depends on`, use one branch/PR per issue, and follow `AGENTS.md` + `task-driven-development`.

## Parallel-plan output

Finish feature planning with a compact plan like:

```text
Parent: #<tracking-issue-number> <title>

Lane A — foundation
1. #<n> <title>
2. #<n> <title>

Lane B — independent UI/API/etc.
1. #<n> <title>

Manual/human-only steps
- <step> — required before/after #<n>

Join
- #<n> <final integration issue> depends on Lane A + Lane B + required manual step
```

Do not claim issues while planning. Browsing/refinement is not implementation.

Create examples:

```bash
gh issue create --title "..." --body "Parent: #<tracking-issue>\n\nGoal:\n..."
gh issue create --title "..." --body "Depends on: #<child-a>\nDepends on: #<child-b>\n\nGoal:\n..."
```

Preserve `FR-nn` / `BR-nn` / `NFR-nn` IDs from `discover-requirements`. Do not silently change
product requirements. After slices exist, run `backlog-refinement` on any issue that is not yet
agent-ready.

Do not duplicate `refine-idea`, `discover-requirements`, or `backlog-refinement`.
