---
name: Discover Requirements
description: Turn a refined product or engineering idea into decision-complete behavioral, business, data, security, integration, and non-functional requirements before design and delivery planning.
tags: [product, requirements, discovery, analysis, planning]
audience: [product-managers, engineers, tech-leads, business-analysts, all]
status: stable
---

# Discover Requirements

Use this skill after an idea has been shaped enough that the problem, target users, desired outcome, and broad MVP are understood, but the expected behavior is not yet precise enough to design or implement safely.

Normally consume the output of `refine-idea`. If the input is still a raw or contradictory idea, use `refine-idea` first rather than inventing requirements for an unstable premise.

## Goal

Produce a **Requirements Discovery Brief** that is complete enough for design/architecture work and later `idea-to-delivery` / `backlog-refinement` without forcing implementation agents to make product decisions.

Requirements describe **what must be true and how the capability behaves**. Avoid prematurely prescribing code structure, libraries, database schemas, or deployment details unless an existing architecture constraint makes them mandatory.

## Discovery method

Be conversational and risk-driven. Resolve the most consequential ambiguity first rather than asking every possible question.

Use available conversation, repository, Architecture Doc, existing GitHub issues, and current system behavior before asking the user for information that can be discovered directly.

Typical discovery order:

1. Confirm actors and scope.
2. Walk the primary happy-path scenario end to end.
3. Identify alternate paths and failure states.
4. Extract business rules and decision logic.
5. Define permissions, tenant boundaries, and visibility.
6. Define data captured, retained, exposed, and audited.
7. Identify integrations and external dependencies.
8. Capture relevant non-functional requirements.
9. Define lifecycle/status behavior when applicable.
10. Define observable acceptance outcomes and unresolved questions.

Do not manufacture precision. Record assumptions explicitly when the user has not decided something.

## Requirement categories

Cover only categories relevant to the feature, but deliberately check each one.

### Actors and permissions

Identify:

- primary user/actor;
- secondary/support/admin/system actors;
- anonymous versus authenticated behavior;
- tenant boundaries;
- ownership and visibility rules;
- create/read/update/delete/execute permissions;
- privileged/support operations and required auditability.

### User and system scenarios

Capture:

- happy path;
- empty/first-use state;
- invalid input;
- authorization denial;
- dependency/integration failure;
- retry/idempotency behavior where relevant;
- partial failure;
- cancellation/abandonment;
- duplicate actions;
- concurrent edits/actions when meaningful;
- mobile/responsive/accessibility considerations for UI features.

### Business rules

Write rules as explicit decisions, for example:

```text
BR-01: A tenant administrator may configure X for users in their tenant.
BR-02: A support agent must not see Y unless permission Z is granted.
```

Prefer deterministic language: MUST / MUST NOT / SHOULD when appropriate.

### Data and lifecycle

Identify:

- data required to perform the capability;
- source of each important data element;
- fields the user can edit versus system-generated values;
- lifecycle/status transitions;
- retention/deletion expectations;
- PII, secrets, credentials, or sensitive technical data;
- audit/history requirements;
- search/filter/sort/export needs when relevant.

Do not invent database tables or schemas during requirements discovery.

### Integrations and events

Identify:

- upstream/downstream systems;
- synchronous versus asynchronous behavior when this is already architecturally constrained;
- external provider failure expectations;
- inbound/outbound notifications;
- domain events or jobs that are behaviorally required;
- correlation/tracing needs for supportable workflows.

For `poc-plattform-kit`, preserve pillar boundaries and architecture decisions already documented in `AGENTS.md` and the Architecture Doc.

### Non-functional requirements

Consider only when material:

- security and least privilege;
- privacy / PII handling;
- auditability;
- accessibility;
- performance and latency expectations;
- scale/volume assumptions;
- reliability, retry, idempotency, and recovery;
- observability and correlation IDs;
- browser/device support;
- localization/timezone/date behavior;
- configurability by tenant/user;
- cost constraints;
- backward compatibility / migration;
- supportability and diagnostics.

Avoid fake numerical targets. If a target matters but is unknown, mark it as an open decision.

## Acceptance outcomes

Requirements discovery should result in observable outcomes, not detailed test scripts.

Use IDs when the capability is substantial:

```text
FR-01: ...
FR-02: ...
NFR-01: ...
BR-01: ...
```

Acceptance outcomes should be specific enough that a later design/ticket can turn them into testable acceptance criteria.

## Open questions

Separate questions into:

- **Blocking** — must be resolved before design or delivery planning;
- **Non-blocking** — safe for implementation/design to decide within stated constraints;
- **Validation** — requires a spike, prototype, user research, vendor check, or architecture investigation.

Never hide a blocking decision inside an assumption.

## Readiness states

Finish with one recommendation:

### READY FOR DESIGN / DELIVERY PLANNING

Use when behavior, rules, actors, important edge cases, relevant NFRs, and dependencies are sufficiently defined and no blocking product questions remain.

Next step depends on the work:

- if UX/UI or architecture **solution** design is still needed, stop and
  ask the user — do not invent screens, schemas, or infra, and do not call
  a design skill that is not in `.cursor/skills/`;
- use `backlog-refinement` for a single existing GitHub issue;
- use `idea-to-delivery` for multi-issue feature planning and GitHub
  execution slicing.

### NEEDS PRODUCT DECISION

Use when a blocking behavioral/business decision remains. Ask the smallest set of questions needed to resolve it.

If the blocker reveals the underlying idea itself is unclear, hand back to `refine-idea`.

### NEEDS VALIDATION / SPIKE

Use when feasibility or an external dependency cannot be safely assumed. Define the exact question the spike/research must answer and the evidence required.

## Requirements Discovery Brief

Use this structure as the normal output:

```text
Capability
<name and short scope>

Source idea
<link/reference or short refined idea summary>

Actors
- <actor>: <role in capability>

In scope
- <behavior/capability>

Out of scope
- <boundary>

Primary flow
1. <step>
2. <step>

Alternate / failure flows
- <scenario> -> <expected behavior>

Functional requirements
- FR-01: <requirement>

Business rules
- BR-01: <rule>

Permissions and tenant boundaries
- <requirement>

Data and lifecycle
- <requirement>

Integrations / events
- <requirement>

Non-functional requirements
- NFR-01: <requirement>

Acceptance outcomes
- <observable outcome>

Dependencies
- <dependency>

Assumptions
- <explicit assumption>

Open questions
Blocking:
- <question or None>

Non-blocking:
- <question or None>

Validation:
- <question or None>

Readiness
READY FOR DESIGN / DELIVERY PLANNING | NEEDS PRODUCT DECISION | NEEDS VALIDATION / SPIKE

Recommended next step
<ask user for design | backlog-refinement | idea-to-delivery | refine-idea | spike>
```

Keep the document proportional. A small UI behavior may need only a short brief; cross-cutting support/auth/billing features deserve more detail.

## Persisting the brief

[`docs/github-source-of-truth.md`](../../../docs/github-source-of-truth.md) §1 and §3 are
authoritative: GitHub Issues own engineering work, including technical discovery — there is no
separate pre-GitHub "discovery" queue.

For `singleton-sd/poc-plattform-kit`, when the user asks to store the brief:

- persist unresolved requirements/discovery as a GitHub issue (open a new one, or update the
  issue the brief originated from);
- validation/spike work stays as an open, not-yet-agent-ready issue until its question is
  answered — do not mark it agent-ready;
- do not create delivery-slice issues (`idea-to-delivery` / `backlog-refinement` territory) while
  blocking requirements remain;
- call out a standalone manual validation/setup step explicitly on the relevant issue only when
  it is a real operational action, not an open question;
- browsing/refinement is not claiming.

Create:

```bash
gh issue create --title "..." --body "..."
```

## Handoff contract

When READY FOR DESIGN / DELIVERY PLANNING:

- preserve requirement IDs and explicit non-goals in downstream design/tickets;
- downstream skills may add implementation direction but must not silently change product requirements;
- if design discovers a conflict requiring a product decision, return to this skill and update the requirements brief.

Do not duplicate the responsibilities of:

- `refine-idea` — validating and shaping the product idea itself;
- design skills — deciding UX/UI or technical solution structure;
- `backlog-refinement` — converting known work into an agent-ready GitHub issue;
- `idea-to-delivery` — creating parent/tracking issues, independently mergeable delivery-slice issues, dependencies, and parallel lanes.
