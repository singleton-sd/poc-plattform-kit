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

- Search existing tasks by title/intent first; never create obvious duplicates.
- If it needs more design, route it to Ideas & Discovery.
- If implementation-ready, route it to Delivery.
- If manual, route it to Human & Operations.
- Wire dependencies by ticket title/id.
- Leave new work unclaimed; planning is not implementation.

Token estimate convention when needed: XS ≈ 25000, S ≈ 50000, M ≈ 100000, L ≈ 200000, XL ≈ 400000.

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

Use ticket titles as the primary human label. IDs belong in URLs, branch names, dependency wiring and secondary references. Keep `[repo=singleton-sd/poc-plattform-kit]` in the task name or description.
