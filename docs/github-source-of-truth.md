# GitHub engineering source of truth

Status: **authoritative**, effective 2026-08-13 ([#171](https://github.com/singleton-sd/poc-plattform-kit/issues/171)).

This document is the single, canonical policy for how engineering work is
identified, sequenced, executed, and closed for `poc-plattform-kit`. It is
part of the migration tracked by
[#170 — Migrate engineering workflow from ClickUp to GitHub](https://github.com/singleton-sd/poc-plattform-kit/issues/170).

Where another document, skill, or instruction file describes engineering
workflow differently, **this document wins** unless that other document has
itself been updated to supersede it. Do not copy this policy's content into
other files — link to this document instead. See
["Known conflicts with this policy"](#known-conflicts-with-this-policy) for
files that still describe the pre-migration ClickUp-based lifecycle and are
intentionally left for later migration issues to update.

## 1. System ownership boundaries

Each kind of information has exactly one authoritative system. Do not
duplicate an authoritative record in a second system "just in case," and do
not treat a non-authoritative copy (a comment, a mirrored status, a stale
export) as the source of truth.

| System | Owns | Does NOT own |
| --- | --- | --- |
| **ClickUp** | Private business/commercial planning: business ideas, commercial strategy, pricing, sales information, customer-private information, contracts, commercially sensitive roadmap, other private business planning. | Anything in the engineering execution lifecycle: no engineering task status, no engineering dependency tracking, no agent claim/handoff state. |
| **GitHub Issues** | Engineering work units: features ready for engineering, technical discovery, bugs, infrastructure work, technical debt, engineering dependencies, executable work assigned to agents. | Commercial/business planning content that has not yet crossed the engineering boundary (see §3). |
| **GitHub Project** | Engineering prioritisation, engineering lifecycle/status, backlog visibility, ready/in-progress/review/done views. | The definition of the work itself (that's the Issue body) or implementation history (that's the PR). Full Project configuration is defined in [#172](https://github.com/singleton-sd/poc-plattform-kit/issues/172) and documented in [`docs/github-project.md`](./github-project.md). |
| **Repository documentation** (`docs/**`, `AGENTS.md`, `.cursor/skills/**`, `.github/agents/**`) | Technical knowledge required by engineers and AI agents: architecture, conventions, runbooks, pipelines. | Business/commercial knowledge. Migration of remaining ClickUp technical docs is [#175](https://github.com/singleton-sd/poc-plattform-kit/issues/175). |
| **Pull requests** | Implementation, code review, review discussion, CI validation, merge state. | Task definition or prioritisation — a PR implements an Issue, it does not replace one. |

ClickUp remains a real, actively used system for the business/commercial
categories above. It is simply no longer part of how engineering work is
defined, sequenced, claimed, or closed.

## 2. No ClickUp engineering synchronization

After this policy takes effect, no step of the engineering lifecycle may
require reading from or writing to ClickUp:

- Engineering work is **not** created as a ClickUp task.
- Engineering status is **not** read from or written to a ClickUp custom
  status.
- Agents do **not** claim engineering work via a ClickUp "Claim Token" or
  similar field.
- PR handoff does **not** depend on a ClickUp transition, comment, or custom
  field.
- GitHub activity (issues, PRs, CI) is **not** mirrored back into ClickUp.

Existing automation that still performs ClickUp reads/writes for engineering
work (workflows, scripts, skills) is legacy and is addressed by the
downstream migration issues in §10, not by this policy document itself.
Do not add *new* ClickUp engineering integrations after this policy lands.

## 3. Engineering lifecycle

```text
Idea / business requirement (ClickUp Ideas & Discovery, or informal)
        |
        v
engineering boundary crossed
   (goal, scope, and acceptance criteria are clear enough to build)
        |
        v
GitHub Issue created
        |
        v
dependency / readiness evaluation
   (Depends on / Blocks / Parent resolved — see section 5)
        |
        v
agent claims the issue
        |
        v
branch / worktree created from origin/main
        |
        v
implementation
        |
        v
fetch + rebase (or merge, per repo conflict playbook) origin/main
        |
        v
relevant tests run
        |
        v
PR opened, linked to the issue (Closes #N)
        |
        v
review / review feedback addressed
        |
        v
merge (human only)
        |
        v
issue closed / GitHub Project column = Done
```

No step in this chain touches ClickUp. An idea may originate in ClickUp
(business framing, commercial motivation) but the moment it becomes
actionable engineering work, a GitHub Issue is opened and the GitHub Issue —
not the ClickUp task — becomes the work's identity from that point forward.

### Crossing the engineering boundary

An idea "crosses the boundary" into engineering when someone (human or
agent) can state, from the idea, a concrete engineering goal, a rough scope,
and at least a first pass at acceptance criteria. At that point:

1. Open a GitHub Issue capturing the goal, scope, acceptance criteria, and
   any known dependencies/constraints.
2. Reference the ClickUp item it originated from in the issue body if useful
   for traceability (a link or short note), but do not require ClickUp
   access to understand or execute the issue.
3. The ClickUp item, if any, is not updated further as engineering
   progresses — it already served its purpose (capturing the business
   framing) and business-side ClickUp bookkeeping is out of scope for
   engineering agents.

## 4. Agent-ready definition

A GitHub Issue is **agent-ready** when all of the following are true:

- It has a clearly defined goal/problem statement.
- Its implementation scope is sufficient to start work without further
  business clarification (an agent should not need to guess intent).
- It has explicit acceptance criteria (a checklist, or clearly stated
  "done when" conditions).
- Relevant constraints are stated (architecture, security, performance,
  compatibility, or anything else that bounds the solution space).
- Relevant technical references are present or discoverable (linked docs,
  related code, related issues).
- Any previously open questions have been resolved to the point that an
  implementer would not have to make an unrecorded judgment call on
  something that materially changes the outcome.
- **It has no unresolved blocking dependency** (see section 5). An issue
  blocked by another open issue is never agent-ready, regardless of how
  well-specified it is.

An issue lacking any of the above is not agent-ready. Refining it into a
ready state is discovery/refinement work, not implementation work, and
should be resolved (via issue edits/comments, or a linked discovery issue)
before an implementation agent claims it.

## 5. Issue dependency semantics and parallel execution

Express relationships between GitHub Issues using explicit, greppable lines
in the issue body (or `gh`/API sub-issue relationships where the repository
has them configured):

```text
Depends on: #123
Blocks: #456
Parent: #100
```

### Semantics

- **`Depends on: #N`** — this issue must not be started until issue `#N` is
  closed (merged and closed, not just PR-open). An agent must treat an issue
  with an unresolved `Depends on` as **not agent-ready**.
- **`Blocks: #N`** — informational inverse of `Depends on`, written on the
  blocking issue so readers can see downstream impact without cross-checking
  every other issue. `Blocks` is not itself a gate; the gate is the
  `Depends on` line on the blocked issue.
- **`Parent: #N`** — this issue is a sub-issue/work item of a larger tracking
  issue `#N` (e.g. a migration umbrella issue). A parent issue is not
  "done" as a unit of implementation; its children are the actual work.

### Rules

- An issue with an unresolved `Depends on` must not be claimed or started.
- Issues with no dependency relationship between them may run concurrently
  in separate worktrees/branches, regardless of whether they touch the same
  repository area — as long as their expected file sets do not
  substantially overlap (see the shared hub-file guidance already defined
  in `AGENTS.md`).
- Agents must not build on another agent's unmerged branch unless the issue
  explicitly declares that dependency (`Depends on: #N` naming that agent's
  issue). Start from `origin/main`, not from another open branch.
- Integration work (an issue whose purpose is to combine multiple upstream
  results) waits until all of its declared `Depends on` issues are closed,
  then starts from the updated `origin/main`.
- Cross-issue coordination happens through GitHub issue comments and PR
  descriptions/links — never through undocumented assumptions or
  out-of-band chat that isn't reflected in the issue.

### Example

```text
#201 Backend ─────┐
#202 Frontend ────┼──> #205 Integration
#203 Infra ───────┘

#204 Documentation runs independently.
```

`#205` declares `Depends on: #201`, `Depends on: #202`, `Depends on: #203`.
`#201`, `#202`, `#203`, and `#204` declare no dependency on each other.

Ready immediately: `#201`, `#202`, `#203`, `#204`.
Blocked: `#205` (until `#201`, `#202`, and `#203` are all closed).

This is exactly the pattern used by the migration umbrella issue
[#170](https://github.com/singleton-sd/poc-plattform-kit/issues/170) itself:
Wave 1 (`#171`) blocks Wave 2 (`#172`–`#175`, parallel), which blocks Wave 3
(`#176`), and so on.

## 6. Issue / branch / worktree / PR relationships

### GitHub issue identity convention

The **GitHub issue number** (`#N`) is the canonical identifier for a unit of
engineering work — it replaces the ClickUp task/custom id used previously.
Do not invent a parallel identifier for new engineering work.

### Branch naming

```text
<type>/<issue-number>-<kebab-title>
```

Examples:

```text
docs/171-github-engineering-source-of-truth
feat/184-support-ticket-api
fix/211-login-redirect
```

`<type>` follows conventional-commit-style prefixes (`feat`, `fix`, `docs`,
`chore`, `refactor`, `test`, etc.) matching the primary nature of the change.
Do not use a ClickUp id in a new engineering branch name.

Worktree folder names mirror the branch's `<issue-number>-<kebab-title>`
portion, following the existing worktree layout in `AGENTS.md` (parent
workspace `repo/` + `worktrees/<slug>/`). Create every new worktree from
`origin/main`.

### PR linking

Every PR must link the issue it implements using a GitHub closing keyword in
the PR body, e.g.:

```text
Closes #171
```

This is what drives "issue closed" as part of the lifecycle in section 3 —
merging the PR automatically closes the linked issue. Use `Closes` (or
`Fixes`/`Resolves`) rather than a plain issue reference, so closure is
automatic and does not depend on a human remembering to close it separately.

### Repository workflow

1. Never work directly on `main`.
2. `git fetch origin` before starting.
3. Create the branch/worktree from `origin/main`.
4. Do not incorporate another agent's branch unless the issue explicitly
   declares that dependency (section 5).
5. Before pushing completed implementation:
   - `git fetch origin`
   - rebase (or merge, per the repository's existing conflict playbook for
     shared hub files in `AGENTS.md`) onto `origin/main`
   - resolve conflicts
   - run the relevant test suite
6. Push with `--force-with-lease` after a rebase, never plain `--force`.
7. Open/update the PR, with `Closes #N` linking the originating issue.
8. If `origin/main` changes while CI/review is running and branch
   protection or mergeability requires it, rebase again and re-push.
9. Humans merge. Agents do not approve or merge their own PRs.

## 7. Public-repository safety boundary

This repository is **public**. Anything committed or posted to it — issues,
PR descriptions and comments, commits, branch names, repository docs,
Actions logs/output — must be treated as permanently and publicly visible,
even if later edited or deleted.

**Never place in the public repository:**

- Secrets, credentials, API tokens, connection strings, deploy tokens.
- Private customer data or anything that identifies a specific customer.
- Customer contracts or confidential commercial agreements.
- Sensitive pricing negotiations or commercial terms.
- Private customer requirements that name or identify the customer.
- Any other information whose disclosure creates commercial, security, or
  privacy risk.

**May remain public:** generic architecture, implementation details,
engineering requirements, and ordinary product capability descriptions.
This is unchanged from the repository's existing secrets policy in
`AGENTS.md` § Secrets + configuration — this section restates it as part of
the engineering source-of-truth policy so it travels with issue/PR
authoring guidance, not because the underlying rule is new.

If engineering work legitimately needs to reference something in the
"never" list (e.g. a real customer's specific requirement), keep that detail
in ClickUp (private business/commercial planning, §1) and write the public
GitHub Issue in generic terms.

## 8. Migration scope boundaries

This document defines policy only. It does not implement the migration.
Downstream issues own their implementation and should treat this document as
settled input, not something to re-decide:

| Issue | Scope | Depends on this policy |
| --- | --- | --- |
| [#172](https://github.com/singleton-sd/poc-plattform-kit/issues/172) | GitHub engineering project, issue templates, PR workflow | Uses §1, §3, §4 to design Project columns/templates |
| [#173](https://github.com/singleton-sd/poc-plattform-kit/issues/173) | Migrate ClickUp-dependent agent skills to GitHub | Uses this document to know what each rewritten skill must say |
| [#174](https://github.com/singleton-sd/poc-plattform-kit/issues/174) | Update repository agent/orchestration instructions for GitHub-native delivery | Uses §3, §5, §6 as the target behavior |
| [#175](https://github.com/singleton-sd/poc-plattform-kit/issues/175) | Migrate technical ClickUp documentation into the repository | Uses §1 to decide what belongs in repo docs |
| [#176](https://github.com/singleton-sd/poc-plattform-kit/issues/176) | Pilot the GitHub-native agent workflow | Validates §3–§6 end to end |
| [#177](https://github.com/singleton-sd/poc-plattform-kit/issues/177) | Migrate active ClickUp engineering backlog to GitHub | Uses §6 issue identity convention for migrated tickets |
| [#178](https://github.com/singleton-sd/poc-plattform-kit/issues/178) | Archive ClickUp Delivery, remove legacy engineering references | Uses §1/§2 as the definition of "done" |

This issue (#171) intentionally does **not**: configure the GitHub Project,
rewrite ClickUp-dependent skills, comprehensively rewrite agent
orchestration instructions, migrate ClickUp technical documentation, migrate
the ClickUp backlog, or archive ClickUp Delivery. Those are the issues
above.

## 9. Known conflicts with this policy

The following existing repository instructions describe the pre-migration,
ClickUp-based engineering lifecycle and now conflict with §2–§6 of this
document. They are **not** rewritten as part of #171 — each is in scope for
one of the downstream issues in §8, noted below. Until that issue lands,
treat this document as authoritative for *policy*, and treat the files below
as authoritative only for the *mechanics* of operations they describe that
this document doesn't yet replace (e.g. the shared hub-file conflict
playbook, worktree tooling) — not for ClickUp claim/handoff/status steps.

| File | Conflict | Owning issue |
| --- | --- | --- |
| `AGENTS.md` §§ "AI loop (mandatory)", "Branch naming", "Worktrees" | ClickUp Claim Token claim/handoff protocol, `feature/<clickup-task-id>-<kebab-title>` branch naming, ClickUp status workflow as the engineering lifecycle | [#174](https://github.com/singleton-sd/poc-plattform-kit/issues/174) |
| `.cursor/skills/task-management/SKILL.md` | ClickUp status workflow and task creation as *the* task management system | [#173](https://github.com/singleton-sd/poc-plattform-kit/issues/173) |
| `.cursor/skills/task-driven-development/SKILL.md` | ClickUp claim/handoff steps embedded in the implementation workflow | [#173](https://github.com/singleton-sd/poc-plattform-kit/issues/173) |
| `.cursor/skills/agent-orchestration/SKILL.md` | ClickUp task ids in branch/worktree naming, ClickUp status/Claim Token transitions in orchestrator responsibilities | [#173](https://github.com/singleton-sd/poc-plattform-kit/issues/173) |
| `.cursor/skills/backlog-refinement/SKILL.md`, `.cursor/skills/idea-to-delivery/SKILL.md`, `.cursor/skills/refine-idea/SKILL.md`, `.cursor/skills/discover-requirements/SKILL.md` | Idea→ticket flow targets ClickUp Ideas & Discovery / Delivery lists rather than GitHub Issues | [#173](https://github.com/singleton-sd/poc-plattform-kit/issues/173) |
| `.cursor/skills/git-conventions/SKILL.md` | Commit format keyed to ClickUp custom ids (`feat: <clickup-id> ...`) rather than GitHub issue numbers | [#173](https://github.com/singleton-sd/poc-plattform-kit/issues/173) |
| `docs/pr-pipelines.md` §§ "PR hygiene", "Complete ClickUp tickets after merge", "Enforced PR handoff gate", "Asynchronous ClickUp recovery" | PR handoff, hygiene labels, and merge completion are gated on ClickUp state via `scripts/clickup.sh handoff`, `complete-clickup-on-merge.yml`, `clickup-pr-recovery.yml` | [#174](https://github.com/singleton-sd/poc-plattform-kit/issues/174) (and workflow changes may extend into [#172](https://github.com/singleton-sd/poc-plattform-kit/issues/172)) |
| `.github/workflows/complete-clickup-on-merge.yml`, `.github/workflows/clickup-pr-recovery.yml`, `.github/workflows/pr-hygiene.yml` (ClickUp-facing parts) | Automation reads/writes ClickUp as part of merge/hygiene lifecycle | [#174](https://github.com/singleton-sd/poc-plattform-kit/issues/174) |
| `scripts/clickup.ps1`, `scripts/clickup.sh`, `scripts/pr-handoff-gate.mjs` | Tooling implements the ClickUp claim/handoff gate described above | [#173](https://github.com/singleton-sd/poc-plattform-kit/issues/173) / [#174](https://github.com/singleton-sd/poc-plattform-kit/issues/174) |
| `README.md` "ClickUp (locked)" section | Presents ClickUp as the ticket source for engineering work | [#175](https://github.com/singleton-sd/poc-plattform-kit/issues/175) |

None of these files are modified by #171. Downstream agents can use this
table as a starting checklist rather than re-discovering the conflicts.
