---
name: Agent Orchestration
description: Coordinate multiple coding agents safely across ClickUp tickets, git worktrees, dependency-aware execution, rebases, CI, and PR handoff. Use when planning or running parallel implementation work across two or more tickets or agents.
tags: [operations, agents, orchestration, git, worktrees, clickup, github]
audience: [engineers, tech-leads, all]
status: stable
---

# Agent Orchestration

Use this skill when work spans multiple tickets or multiple coding agents and the main risk is coordination: stale branches, overlapping files, dependency ordering, or PRs becoming unmergeable as `main` moves.

This skill coordinates work. It does not replace `task-driven-development`; each implementing agent still follows that skill for claiming, implementation, testing, PR hygiene, and ClickUp handoff.

## Goals

- Maximise safe parallelism.
- Keep every agent isolated in its own git worktree and branch.
- Keep feature branches current with `origin/main`.
- Prevent agents from building on unmerged feature branches; wait for prerequisites to merge to `main` before starting dependent tickets.
- Start dependent work from the merged result on `main`, not from another agent's branch.
- Keep CI and mergeability authoritative before handoff.
- Remove stale worktrees after work is merged or abandoned.

## Repository workflow

Every implementing agent must follow this baseline:

1. Never work directly on `main`.
2. Fetch `origin` before starting.
3. Create the agent branch and worktree from current `origin/main`.
4. Do not incorporate another agent's branch unless the ticket explicitly declares that dependency and the orchestrator has approved the exception.
5. Before pushing a completed implementation or updating a PR:
   - `git fetch origin main`
   - Refresh your branch from `origin/main` following `AGENTS.md` (prefer `git merge origin/main` when the repo conflict playbook applies; rebase only when appropriate)
   - resolve conflicts using the repository conflict playbook
   - run the full relevant test suite
6. If you refreshed via rebase on a previously-pushed branch, push with `git push --force-with-lease`.
7. Open or update the PR and wait for required CI.
8. If `origin/main` changes while CI is running and branch protection or mergeability requires freshness, rebase again, rerun relevant tests, push with `--force-with-lease`, and rerun CI.

Never use plain `--force`.

If `AGENTS.md` defines a repository-specific conflict playbook for special hub files, follow it for those conflicts rather than inventing a manual merge strategy. In particular, do not hand-merge generated lockfiles or generated infrastructure output when the repository provides regeneration tooling.

## Worktree isolation

Each agent gets exactly one worktree for the ticket it owns.

Branch naming must follow `AGENTS.md`, normally:

```text
feature/<clickup-task-id>-<kebab-title>
hotfix/<clickup-task-id>-<kebab-title>
```

Typical setup (parent workspace: `repo/` + `worktrees/<id>-<slug>/`):

```powershell
pnpm worktree:add -- -TaskId <clickup-task-id> -Slug <kebab-title>
```

Linux / Cloud: `./scripts/add-worktree.sh --task-id <clickup-task-id> --slug <kebab-title>`

Rules:

- The canonical `main` checkout is read-only for agents.
- Never let two agents share a worktree.
- Never reuse a dirty worktree for a different ticket.
- Keep dependency caches shared where safe, but source trees isolated.
- Remove the worktree after merge or abandonment:

```bash
git worktree remove ../worktrees/<clickup-task-id>-<kebab-title>
git worktree prune
```

Delete the local feature branch after the PR is merged if normal repository cleanup does not already do it.

## Build a dependency DAG before launching agents

Before starting multiple tickets, classify each ticket as one of:

- **Independent**: can start immediately from `origin/main`.
- **Depends on**: must wait for one or more tickets to merge.
- **Potential conflict**: logically independent but likely to touch the same hub or high-churn files.
- **Human/infra gate**: blocked on credentials, external provisioning, review, or another manual action.

Represent the work as a DAG, for example:

```text
A ─────┐
       ├── D
B ─────┘

C ───────── E
```

Here `A`, `B`, and `C` can start in parallel. `D` starts only after both `A` and `B` are merged to `main`. `E` starts after `C` is merged.

Do not start a downstream ticket early just to keep an agent busy. Starting from stale or unmerged dependencies creates avoidable conflict chains.

## Parallelisation rules

Safe to run in parallel when all are true:

- No declared dependency exists between the tickets.
- The expected file sets do not substantially overlap.
- They do not require incompatible schema, API contract, or infrastructure changes.
- They can each be tested independently.

Prefer sequencing when any are true:

- One ticket introduces a contract consumed by another.
- Both modify a high-churn hub such as root workspace files, shared workflows, central app wiring, generated infrastructure, or shared skills.
- One ticket is a foundation or migration that changes the shape of later implementation.
- The second ticket would otherwise need to cherry-pick or merge the first agent's branch.

When sequencing, merge the foundation PR first, then create the downstream agent worktree from the new `origin/main`.

## Main branch movement

`origin/main` is the only integration source of truth.

When another PR merges:

- Independent agents may continue working, but must rebase before their next completed push/handoff.
- Agents whose code overlaps the merged PR should rebase as soon as practical, before doing substantial additional work.
- Agents blocked by that PR start only after the merge and fetch the new `origin/main`.

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

Dependent work starts from the updated `main` after its prerequisites merge.

## Rebase conflict rules

For normal source conflicts:

1. `git fetch origin`
2. `git rebase origin/main`
3. Resolve only conflicts relevant to the ticket.
4. Continue with `git rebase --continue`.
5. Run relevant tests.
6. Push with `git push --force-with-lease`.
7. Recheck PR mergeability and CI.

Abort the rebase if conflict resolution would require guessing another ticket's intended behaviour. Surface the dependency or conflict to the orchestrator instead of silently combining unrelated changes.

For repository-defined hub/generated-file conflicts, follow `AGENTS.md` and repository scripts. The repository conflict playbook takes precedence over generic manual conflict resolution.

## PR freshness and handoff

Before an agent hands work off:

- `origin/main` has been fetched recently.
- The branch is rebased onto current `origin/main`, unless the repository conflict playbook explicitly requires a merge commit for a special conflict case.
- Relevant tests pass after the refresh.
- Required CI is green.
- GitHub reports the PR as mergeable / not dirty.
- Actionable review feedback is resolved.
- ClickUp handoff follows `task-driven-development` and `AGENTS.md`.

If `main` changes after CI completes but before merge, do not blindly rebuild every PR. Refresh only when branch protection, mergeability, dependency changes, or meaningful overlap makes it necessary.

## Orchestrator responsibilities

The orchestrator coordinates; it does not steal implementation ownership from agents.

Before launch:

1. Read candidate ticket details and declared dependencies.
2. Build the dependency DAG.
3. Identify shared-file collision risk.
4. Group work into parallel waves.
5. Ensure each implementation ticket is claimable under the repository's Claim Token protocol.
6. Launch only the tickets whose prerequisites are satisfied.

During execution:

1. Track which ticket owns each worktree and branch.
2. Track PR state: open, CI, mergeable, feedback, merged.
3. When `main` moves, identify agents that need an early refresh versus agents that can wait until handoff.
4. Do not resolve code conflicts on behalf of an agent unless explicitly taking over that ticket.
5. Do not merge PRs; human merge policy remains authoritative.

After merge:

1. Mark downstream dependencies as unblocked.
2. Start newly-ready tickets from the latest `origin/main`.
3. Remove merged ticket worktrees and prune stale worktree metadata.
4. Keep ClickUp status/Claim Token transitions aligned with `AGENTS.md`.

## Execution plan format

When the user asks to spin up several agents, return a concise execution plan like:

```text
Wave 1 — parallel
- Ticket A — independent
- Ticket B — independent
- Ticket C — independent, low overlap

Wave 2 — after A + B merge
- Ticket D — depends on A and B

Wave 3 — after C merge
- Ticket E — depends on C
```

For each wave, include:

- Ticket title and id.
- Dependencies.
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
3. Create your branch/worktree from origin/main with `pnpm worktree:add` (parent `worktrees/<id>-<slug>`).
4. Do not incorporate another agent's branch unless the ticket explicitly declares a dependency.
5. Before pushing completed work:
   - git fetch origin
   - git rebase origin/main
   - resolve conflicts using repository conflict rules
   - run the full relevant test suite
6. Push with --force-with-lease after a rebase.
7. Open/update the PR and complete PR hygiene.
8. If origin/main changes while CI is running, refresh again only when required by branch protection, mergeability, dependency changes, or meaningful overlap.
9. Never merge your own PR.
10. Remove the worktree when the run is finished or the PR has merged, according to orchestrator cleanup policy.
```

Also include the ticket-specific dependencies and explicitly state which prerequisite PRs must already be merged before the agent starts.

## Relationship to other skills

- `task-driven-development`: per-ticket claim, implementation, testing, PR hygiene, and ClickUp handoff.
- `backlog-refinement`: sizing, decomposition, acceptance criteria, and dependency discovery before execution.
- Repository-specific implementation/testing skills: apply inside each ticket after orchestration decides when the agent can start.

When rules conflict, repository-level `AGENTS.md` and locked project policies take precedence.