---
name: Refine Idea
description: Shape a raw product or engineering idea into a clear, challenged, value-focused concept before requirements discovery or delivery planning.
tags: [product, discovery, ideation, strategy, planning]
audience: [product-managers, engineers, tech-leads, founders, all]
status: stable
---

# Refine Idea

Use this skill when the user has a rough idea, feature thought, transcript, pain point, opportunity, or solution proposal and wants help deciding what the idea actually is and whether it is worth pursuing.

This skill is deliberately **before requirements discovery**. Do not turn the idea directly into implementation tickets unless the user explicitly asks to skip discovery and the idea is already decision-complete.

## Goal

Produce a concise **Refined Idea Brief** that answers:

- What problem are we solving?
- Who has the problem?
- Why does it matter?
- What outcome would make the idea valuable?
- What assumptions are we making?
- What alternatives exist?
- What is the smallest useful version?
- What is intentionally not part of the idea?
- What material unknowns still need requirements discovery, research, design, or technical validation?

The agent is expected to challenge the premise. A valid outcome is **do not build**, **defer**, **combine with existing capability**, or **run discovery first**.

## Conversational discovery

Do not dump a questionnaire on the user. Progressively resolve the highest-value uncertainty first.

Prefer one focused question at a time when user input is needed. Use existing repository, architecture, GitHub issues, and conversation context before asking questions the answer may already contain.

Typical sequence:

1. Restate the idea in one sentence.
2. Identify the user/problem, not just the proposed solution.
3. Clarify desired outcome and why now.
4. Separate the core capability from adjacent ideas.
5. Challenge major assumptions and obvious alternatives.
6. Define MVP / first useful slice.
7. Identify risks, dependencies, and unknowns.
8. Decide whether the idea is ready for `discover-requirements`.

Do not force all steps when the idea is already clear.

## What to challenge

When relevant, test the idea against:

- existing capability that may already solve the problem;
- whether the proposed solution addresses the real user pain;
- who benefits and who bears operational cost;
- security, privacy, compliance, support, and abuse implications;
- tenant/user configurability versus unnecessary complexity;
- build versus buy versus integrate;
- coupling to existing pillars or architecture boundaries;
- expected frequency and severity of the problem;
- whether an MVP can validate value before a large investment;
- whether multiple ideas have been accidentally bundled together.

For `poc-plattform-kit`, inspect the Architecture Doc and existing GitHub issues when doing so
would materially change the recommendation. Browsing is not claiming work.

## Split bundled ideas

If one statement contains multiple independently valuable capabilities, split them conceptually before requirements work.

For each candidate capability identify:

- the problem it solves;
- whether it can ship independently;
- whether it depends on another capability;
- whether it belongs in the current idea or should become a separate follow-up.

Do not create implementation slices yet. That is the responsibility of
`idea-to-delivery` after `discover-requirements` marks the work
`READY FOR DESIGN / DELIVERY PLANNING`. A single existing GitHub issue
goes to `backlog-refinement` instead.

## Readiness states

Finish with exactly one readiness recommendation:

### READY FOR REQUIREMENTS

Use when the problem, users, desired outcome, MVP boundary, and major product assumptions are sufficiently clear. Hand off to `discover-requirements`.

### NEEDS VALIDATION

Use when the core value proposition or feasibility depends on evidence not yet available. State the smallest research/spike/prototype needed to resolve it.

### HOLD / DO NOT BUILD

Use when the idea is low value, duplicates existing capability, creates disproportionate cost/risk, or is solving the wrong problem. Explain why and, when useful, give a simpler alternative.

## Refined Idea Brief

Use this structure as the normal output:

```text
Idea
<one-sentence refined concept>

Problem
<user pain / opportunity>

Target users
<primary actors>

Desired outcome
<observable value>

Proposed capability
<solution at product level, not implementation design>

MVP
- <minimum useful capability>

Later / optional
- <valuable but non-essential capability>

Non-goals
- <explicit boundary>

Assumptions challenged
- <assumption> -> <assessment>

Alternatives considered
- <alternative> -> <why chosen/rejected>

Risks / unknowns
- <item>

Readiness
READY FOR REQUIREMENTS | NEEDS VALIDATION | HOLD / DO NOT BUILD

Next step
<discover-requirements, research/spike, or stop>
```

Keep the brief proportional to the idea. Small ideas do not need ceremony.

## Persisting the brief

[`docs/github-source-of-truth.md`](../../../docs/github-source-of-truth.md) section 1 and section 3 are
authoritative: GitHub Issues own engineering work, including technical discovery — there is no
separate pre-GitHub "ideas" queue for anything that has already crossed into engineering framing.

For `singleton-sd/poc-plattform-kit`, only when the user asks to store the brief:

- **READY FOR REQUIREMENTS** or **NEEDS VALIDATION** (a spike is genuinely engineering
  discovery): open (or update) a GitHub issue capturing the brief. Do not mark it agent-ready —
  that happens later, via `discover-requirements` → `backlog-refinement` /
  `idea-to-delivery`, once the open questions are resolved.
- **HOLD / DO NOT BUILD**: no issue is needed unless the user wants the rejection recorded for
  future reference (a comment on a related existing issue is usually enough).
- A private business/commercial idea that has **not yet** crossed the engineering boundary (see
  `docs/github-source-of-truth.md` section 3) is out of this skill's scope to file anywhere — that is
  business planning, not engineering discovery.

Browsing/refinement is not claiming: filing the issue does not assign it to anyone.

Create:

```bash
gh issue create --title "..." --body "..."
```

## Handoff contract

When READY FOR REQUIREMENTS, hand the Refined Idea Brief to `discover-requirements`.

`discover-requirements` may send the work back here if it uncovers a fundamental product ambiguity such as an unclear target user, unresolved value proposition, or multiple incompatible product directions.

Do not duplicate the responsibilities of:

- `discover-requirements` — detailed behavior, rules, actors, scenarios, NFRs, data/integration requirements;
- `backlog-refinement` — making an existing backlog item decision-complete and agent-ready;
- `idea-to-delivery` — parent/tracking issues, delivery-slice issues, dependencies, and parallel lanes.
