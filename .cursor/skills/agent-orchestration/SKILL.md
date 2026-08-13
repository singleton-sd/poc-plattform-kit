---
name: Agent Orchestration
description: Coordinate multiple coding agents safely across GitHub issues, git worktrees, dependency-aware execution, rebases, CI, and PR handoff. Use when planning or running parallel implementation work across two or more issues or agents.
tags: [operations, agents, orchestration, git, worktrees, github]
audience: [engineers, tech-leads, all]
status: stable
---

# Agent Orchestration

Use this skill when work spans multiple GitHub issues or multiple coding agents and the main risk is coordination: stale branches, overlapping files, dependency ordering, or PRs becoming unmergeable as `main` moves.

This skill coordinates work. It does not replace `task-driven-development`; each implementing agent still follows that skill for claiming, implementation, testing, and PR handoff. Both skills follow
[`docs/github-source-of-truth.md`](../../../docs/github-source-of-truth.md), the authoritative policy for how engineering work is identified, sequenced, and executed — this skill applies that policy to *multi-agent* coordination specifically and does not restate it.

## Goals

- Maximise safe parallelism.
- Keep every agent isolated in its own git worktree and branch.
- Keep feature branches current with `origin/main`.
- Prevent agents from building on unmerged feature branches; wait for prerequisites to merge to `main` before starting dependent issues.
- Start dependent work from the merged result on `main`, not from another agent's branch.
- Keep CI and mergeability authoritative before handoff.
- Remove stale worktrees after work is merged or abandoned.

## Repository workflow

Every implementing agent must follow this baseline (`docs/github-source-of-truth.md` §6):

1. Never work directly on `main`.
2. Fetch `origin` before starting.
3. Create the agent branch and worktree from current `origin/main`.
4. Do not incorporate another agent's branch unless the issue explicitly declares that dependency (`Depends on: #N`) and that issue is closed.
5. Before pushing a completed implementation or updating a PR:
   - `git fetch origin main`
   - Refresh your branch from `origin/main` following `AGENTS.md` (prefer `git merge origin/main` when the repo conflict playbook applies; rebase only when appropriate)
   - resolve conflicts using the repository conflict playbook
   - run the full relevant test suite
6. If you refreshed via rebase on a previously-pushed branch, push with `git push --force-with-lease`.
7. Open or update the PR (`Closes #N`) and wait for required CI.
8. If `origin/main` changes while CI is running and branch protection or mergeability requires freshness, rebase again, rerun relevant tests, push with `--force-with-lease`, and rerun CI.

Never use plain `--force`.

If `AGENTS.md` defines a repository-specific conflict playbook for special hub files, follow it for those conflicts rather than inventing a manual merge strategy. In particular, do not hand-merge generated lockfiles or generated infrastructure output when the repository provides regeneration tooling.

## Worktree isolation

Each agent gets exactly one worktree for the issue it owns.

Branch naming must follow `docs/github-source-of-truth.md` §6:

```text
<type>/<issue-number>-<kebab-title>
```

Typical setup (parent workspace: `repo/` + `worktrees/<issue-number>-<slug>/`):

```powershell
pnpm worktree:add -- -TaskId <issue-number> -Slug <kebab-title>
```

Linux / Cloud: `./scripts/add-worktree.sh --task-id <issue-number> --slug <kebab-title>`

Rules:

- The canonical `main` checkout is read-only for agents.
- Never let two agents share a worktree.
- Never reuse a dirty worktree for a different issue.
- Keep dependency caches shared where safe, but source trees isolated.
- Remove the worktree after merge or abandonment:

```bash
git worktree remove ../worktrees/<issue-number>-<kebab-title>
git worktree prune
```

Delete the local feature branch after the PR is merged if normal repository cleanup does not already do it.

## Build a dependency DAG before launching agents

Before starting multiple issues, read each candidate issue's body for its
`Depends on:` / `Blocks:` / `Parent:` lines (`docs/github-source-of-truth.md`
§5) and classify each as one of:

- **Independent**: no unresolved `Depends on` — can start immediately from `origin/main`.
- **Depends on**: `Depends on: #N` names an issue that is not yet closed — must wait.
- **Potential conflict**: no declared dependency, but logically likely to touch the same hub or high-churn files as another in-flight issue.
- **Human/infra gate**: blocked on credentials, external provisioning, review, or another manual action — not expressible as a `Depends on` line, so verify by reading the issue body/comments.

Represent the work as a DAG, for example:

```text
A ─────┐
       ├── D
B ─────┘

C ───────── E
```

Here `A`, `B`, and `C` can start in parallel. `D` starts only after both `A` and `B` are merged (their issues closed) on `main`. `E` starts after `C` is merged.

A GitHub Issue with an unresolved `Depends on` is **never agent-ready**
(`docs/github-source-of-truth.md` §4), regardless of how well-specified it
is. Do not start a downstream issue early just to keep an agent busy.
Starting from stale or unmerged dependencies creates avoidable conflict
chains.

## Parallelisation rules

Safe to run in parallel when all are true:

- No `Depends on` relationship exists between the issues (check both issue bodies).
- The expected file sets do not substantially overlap.
- They do not require incompatible schema, API contract, or infrastructure changes.
- They can each be tested independently.

Prefer sequencing when any are true:

- One issue introduces a contract consumed by another.
- Both modify a high-churn hub such as root workspace files, shared workflows, central app wiring, generated infrastructure, or shared skills.
- One issue is a foundation or migration that changes the shape of later implementation.
- The second issue would otherwise need to cherry-pick or merge the first agent's branch.

When sequencing, merge the foundation PR first, then create the downstream agent worktree from the new `origin/main`.

## Main branch movement

`origin/main` is the only integration source of truth.

When another PR merges:

- Independent agents may continue working, but must rebase before their next completed push/handoff.
- Agents whose code overlaps the merged PR should rebase as soon as practical, before doing substantial additional work.
- Agents blocked by that PR (via `Depends on`) start only after the merge closes the prerequisite issue and fetch the new `origin/main`.

Do not keep a long-lived chain like:

```text
main <- agent-A <- agent-B <- agent-C
```

Prefer:

```text
main -> A -> merge
main -> B -> rebase -> merge
main -> C -> rebase -> merge
```

Dependent work starts from the updated `main` after its prerequisite issues close.

## Rebase conflict rules

For normal source conflicts:

1. `git fetch origin`
2. `git rebase origin/main`
3. Resolve only conflicts relevant to the issue.
4. Continue with `git rebase --continue`.
5. Run relevant tests.
6. Push with `git push --force-with-lease`.
7. Recheck PR mergeability and CI.

Abort the rebase if conflict resolution would require guessing another issue's intended behaviour. Surface the dependency or conflict to the orchestrator instead of silently combining unrelated changes.

For repository-defined hub/generated-file conflicts, follow `AGENTS.md` and repository scripts. The repository conflict playbook takes precedence over generic manual conflict resolution.

## PR freshness and handoff

Before an agent hands work off:

- `origin/main` has been fetched recently.
- The branch is rebased onto current `origin/main`, unless the repository conflict playbook explicitly requires a merge commit for a special conflict case.
- Relevant tests pass after the refresh.
- Required CI is green.
- GitHub reports the PR as mergeable / not dirty.
- Actionable review feedback is resolved.
- The PR body links its issue with a closing keyword (`Closes #N`) — merging the PR is what closes the issue; no separate status transition is needed.

If `main` changes after CI completes but before merge, do not blindly rebuild every PR. Refresh only when branch protection, mergeability, dependency changes, or meaningful overlap makes it necessary.

## Orchestrator responsibilities

The orchestrator coordinates; it does not steal implementation ownership from agents.

Before launch:

1. Read candidate issue bodies and their declared `Depends on` / `Blocks` / `Parent` lines.
2. Build the dependency DAG.
3. Identify shared-file collision risk.
4. Group work into parallel waves.
5. Confirm each issue meets the agent-ready definition (`docs/github-source-of-truth.md` §4) — clear goal, scope, acceptance criteria, no unresolved blocking `Depends on`.
6. Launch only the issues whose prerequisites are satisfied (closed).

During execution:

1. Track which issue owns each worktree and branch.
2. Track PR state: open, CI, mergeable, feedback, merged.
3. When `main` moves, identify agents that need an early refresh versus agents that can wait until handoff.
4. Do not resolve code conflicts on behalf of an agent unless explicitly taking over that issue.
5. Do not merge PRs; human merge policy remains authoritative.

After merge:

1. Mark downstream `Depends on` relationships unblocked (the prerequisite issue is now closed).
2. Start newly-ready issues from the latest `origin/main`.
3. Remove merged issue worktrees and prune stale worktree metadata.

## Execution plan format

When the user asks to spin up several agents, return a concise execution plan like:

```text
Wave 1 — parallel
- #201 Backend — independent
- #202 Frontend — independent
- #203 Infra — independent, low overlap

Wave 2 — after #201 + #202 merge
- #205 Integration — depends on #201, #202

Wave 3 — after #203 merges
- #206 Follow-up — depends on #203
```

For each wave, include:

- Issue title and number.
- `Depends on` relationships.
- Expected shared/hub files.
- Branch/worktree name.
- Whether it can run in parallel.
- Required test/CI gate before handoff.

## Agent launch prompt requirements

Every spawned implementation agent must be told:

```text
Repository workflow

1. Never work directly on main.
2. Fetch origin before starting.
3. Create your branch/worktree from origin/main with `pnpm worktree:add`
   (parent `worktrees/<issue-number>-<slug>`).
4. Do not incorporate another agent's branch unless the issue explicitly
   declares a `Depends on` dependency on a now-closed issue.
5. Before pushing completed work:
   - git fetch origin
   - git rebase origin/main
   - resolve conflicts using repository conflict rules
   - run the full relevant test suite
6. Push with --force-with-lease after a rebase.
7. Open/update the PR with `Closes #<issue-number>` and complete PR hygiene.
8. If origin/main changes while CI is running, refresh again only when
   required by branch protection, mergeability, dependency changes, or
   meaningful overlap.
9. Never merge your own PR.
10. Remove the worktree when the run is finished or the PR has merged,
    according to orchestrator cleanup policy.
```

Also include the issue-specific `Depends on` relationships and explicitly state which prerequisite issues/PRs must already be closed/merged before the agent starts.

## Relationship to other skills

- `task-driven-development`: per-issue claim, implementation, testing, and GitHub PR handoff.
- `backlog-refinement` / `idea-to-delivery`: sizing, decomposition, acceptance criteria, and dependency discovery before execution.
- Repository-specific implementation/testing skills: apply inside each issue after orchestration decides when the agent can start.

When rules conflict, `docs/github-source-of-truth.md` and repository-level `AGENTS.md` locked policies take precedence.
