# GitHub-native workflow pilot

Issue [#176](https://github.com/singleton-sd/poc-plattform-kit/issues/176)
validates the engineering workflow defined in
[`github-source-of-truth.md`](./github-source-of-truth.md). This record uses
real repository work created after the migration; it does not recreate the
same state in ClickUp.

## Pilot cohort

| Workflow case | GitHub evidence | Result |
| --- | --- | --- |
| Corrective task | Issue #194 and merged PR #195 | Completed through issue, `ci/194-...` branch, PR review, merge, and automatic issue closure. |
| Discovery and decomposition | Tracking issue #196 | Goal, locked decisions, scope, child issues, and dependency graph are readable from GitHub alone. |
| Parallel implementation | Issues #197, #198, #199, and #200 with PRs #206, #207, #208, and #209 | Four independent, agent-ready issues produced four isolated issue-number branches and non-overlapping PRs. |
| Blocked integration | Issue #201 | Correctly remains labelled `blocked` while its four `Depends on:` issues are open. It must start from updated `origin/main` only after they close. |

## Validation

### Ready and blocked work

- Issues #197-#200 have explicit goals, scope, acceptance criteria,
  constraints, technical references, `Depends on: none`, and the
  `agent-ready` label.
- Issue #201 lists all four prerequisites with explicit `Depends on:` lines,
  leaves the dependency checklist incomplete, and carries the `blocked`
  label.
- No ClickUp lookup is required to distinguish the two states.

### Claiming and isolation

- PRs #206-#209 link their originating issues with `Closes #N`.
- Their branches use the required GitHub identity convention:
  `feat/197-...`, `feat/198-...`, `feat/199-...`, and `feat/200-...`.
- An agent checking any of those issues can see the existing linked open PR
  and avoid starting a competing implementation.
- Each implementation has its own worktree and branch. The issue scopes keep
  the parallel file sets separate.

### Review and closure

- Issue #194 and PR #195 prove the corrective path through merge and
  automatic issue closure.
- PRs #206-#209 prove the open-review path and remain the evidence needed to
  validate closure for the parallel cohort.
- Issue #201 must not be claimed until #197-#200 close. Its later PR will
  validate dependency release and integration from refreshed `origin/main`.

### Skills and repository instructions

The pilot uses the same behavior in both layers:

- `AGENTS.md` defines GitHub Issues as the work identity, linked open PRs as
  the claim signal, dependency blocking, issue-number branch names, isolated
  worktrees, and human-only merge.
- `.cursor/skills/task-driven-development/SKILL.md`,
  `.cursor/skills/agent-orchestration/SKILL.md`, and
  `.cursor/skills/git-conventions/SKILL.md` use the same conventions.
- The cohort exposed no remaining contradiction between those instructions.

## Remaining pilot gates

The workflow is structurally validated, but issue #176 must remain open until
all of the following are true:

- PRs #206-#209 merge and automatically close issues #197-#200.
- The `blocked` label is removed from #201 only after all dependencies close.
- #201 starts from the resulting `origin/main`, completes through a linked
  PR, and verifies the deployed preview lifecycle described in its acceptance
  criteria.
- The repository's live GitHub Project status transitions are verified. The
  configuration is specified in [`github-project.md`](./github-project.md),
  but PR #181 recorded that creating/configuring the live Project required
  permissions unavailable to its implementation session. Issue #212 tracks
  that blocking setup and verification work.

Until these gates pass, #177 remains blocked. This is intentional: an open PR
is evidence that claiming and review work, but it is not evidence that merge,
automatic closure, deployment, or Project completion work.

## Exit criteria

After the remaining gates pass, update this record with the resulting PR
links and observed Project transitions, close #176 through its PR, and begin
#177. Any failure becomes a blocking GitHub issue linked from #176; it is not
mirrored into ClickUp.
