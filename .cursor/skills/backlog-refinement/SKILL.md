---
name: Backlog Refinement
description: Refine raw ideas and backlog items into decision-complete, agent-ready GitHub issues for poc-plattform-kit, with dependencies expressed as Depends on/Blocks/Parent.
tags: [product, planning, agile, writing, github]
audience: [product-managers, engineers, tech-leads]
status: stable
---

# Backlog Refinement

Use this skill to turn a rough idea, bug, feature request, transcript, or existing GitHub issue
into work that can be safely executed by humans and AI agents.

For multi-issue feature planning, also apply `idea-to-delivery`.

## GitHub as the engineering tracker

For `singleton-sd/poc-plattform-kit`, engineering work — including technical discovery, spikes,
bugs, infrastructure work, and technical debt — lives as **GitHub Issues** in this repository.
See [`docs/github-source-of-truth.md`](../../../docs/github-source-of-truth.md) section 1 and section 3 for the
authoritative system-ownership and lifecycle policy. Architecture/design decision documentation
still lives where the repository's docs conventions put it (`docs/**` or the ClickUp Architecture
Doc, per current repository convention) — that's a documentation-ownership question, not an
engineering-tracking one, and this skill doesn't change it.

## Refinement decision

Classify the input before creating implementation work:

- **Tiny isolated change:** one GitHub issue.
- **Medium feature:** a parent/tracking issue (`Parent: #N` on each child) + roughly 2–5 child issues.
- **Large/cross-cutting or materially uncertain work:** open a discovery issue first; once
  decisions are made, open the parent/tracking issue and delivery-slice issues that declare
  `Parent: #<tracking-issue>`.
- **Manual requirement:** call this out explicitly in the relevant issue (e.g. a checklist item
  or a linked issue) rather than pretending an AI implementer can complete it — do not silently
  fold a manual step into an "AI-ready" issue.

Default slicing rule: one independently mergeable PR is usually one GitHub issue.

## Required issue shape

```text
Title: <concise action-oriented title>

Parent: <#issue number, or omit>
Depends on: <#issue number(s), or omit>
Blocks: <#issue number(s), or omit>

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
- <how the feature/bug is demonstrated in PR previews when applicable — see
  docs/preview-scenarios.md>

Testing:
- <automated expectations>
- <human validation expectations>

Out of scope:
- <true non-goals>

Open questions:
- <must be empty before the issue is agent-ready, unless explicitly safe for implementer choice>
```

For bugs also include Steps to reproduce, Expected behavior and Actual behavior.

Use `Depends on:` / `Blocks:` / `Parent:` exactly as plain, greppable lines
(`docs/github-source-of-truth.md` section 5) — do not bury dependency information only in prose.

## Agent-ready gate

An issue may be handed to an implementing agent only when it satisfies the agent-ready definition
in `docs/github-source-of-truth.md` section 4: clear goal/problem statement, sufficient scope, testable
acceptance criteria, stated constraints, discoverable technical references, no unresolved open
questions that would force an implementer to make an unrecorded judgment call, and **no
unresolved `Depends on`**.

Otherwise leave the issue open with its gaps visible (e.g. via an "Open questions" section or a
comment) rather than handing ambiguity to an implementation agent.

## Architecture documentation

For architecture, design, new Azure resources, auth, messaging, pillar boundaries, secrets/config,
CI/CD topology, or other cross-cutting plans:

1. Update/add the relevant Architecture Doc page with goal, chosen approach, trade-offs,
   boundaries, operational implications and links to work (documentation ownership/location is
   unchanged by this skill — see `docs/github-source-of-truth.md` section 1 and the migration tracked in
   [#175](https://github.com/singleton-sd/poc-plattform-kit/issues/175)).
2. Create the parent/tracking issue and implementation-slice issues after the decision is
   documented.
3. Put the Architecture Doc link in relevant issue bodies.

## Out-of-scope follow-ups

Every real follow-up discovered during refinement must be represented explicitly rather than
hidden in prose.

1. Search existing issues by title/intent first (no duplicates): `gh issue list --search "..."`.
2. If missing, create it: `gh issue create --title "..." --body "..."`.
3. Include clear acceptance criteria in the body.
4. Wire dependency by adding `Depends on: #<parent>` to the new issue's body (and `Blocks: #<new>`
   on the parent, if useful).
5. Leave new backlog issues **unassigned** — filing/browsing is not claiming.
6. Prefer linking via `Depends on` / `Parent` over a parent-issue comment dump.

## Parent issue and parallel execution

For medium/large features, finish refinement with:

- Parent/tracking issue title and outcome;
- child issue titles, each declaring `Parent: #<tracking-issue>`;
- explicit manual/human-only steps called out on the relevant issue;
- dependency graph (`Depends on` / `Blocks` lines across the children);
- parallel lanes;
- join/final integration issue;
- explicit list of issues that are agent-ready now.

Do not mark every issue agent-ready at once when dependencies make that unsafe — an issue with an
unresolved `Depends on` is never agent-ready regardless of how well-specified it is.

## Naming

Use issue titles as the primary human label. Numbers belong in URLs, branch names
(`<type>/<issue-number>-<kebab-title>`), and dependency lines (`Depends on:` / `Blocks:` /
`Parent:`).
