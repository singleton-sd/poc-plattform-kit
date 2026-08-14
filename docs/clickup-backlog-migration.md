# ClickUp Delivery backlog migration evidence

Status: completed on 2026-08-14 for GitHub issue #177.

This record documents the one-time, read-only review of the legacy ClickUp
Delivery list. GitHub Issues and the Platform Kit Engineering Project are now
the authoritative engineering backlog. ClickUp links below are historical
trace references only; no migrated issue requires ClickUp access.

## Source inventory

The audit read every page of Delivery list `901616287298`, including closed
tasks and subtasks. It found 213 records: 147 top-level tasks and 66 subtasks.

| Legacy status | Count | Migration treatment |
| --- | ---: | --- |
| Complete | 135 | Retained as ClickUp history; not migrated. |
| Ready for human | 4 | Reconciled against merged PRs; not duplicated. |
| Ready for review | 7 | Merged work was excluded; three open PRs were linked to new GitHub issues. |
| In progress | 4 | Reconciled against merged/current PRs and migrated where still active. |
| Backlog | 25 | Classified as actionable, discovery, consolidated, or obsolete. |
| To do | 38 | Classified as actionable, discovery, consolidated, or obsolete. |

The review used task descriptions and dependencies, not status names alone.
GitHub issue and PR searches were performed before each migration group to
avoid recreating work already delivered or already tracked.

## Migrated actionable work

### Node tooling program

The legacy Node migration epic and its nine active slices became #222-#231.
The issue bodies preserve the executable scope, acceptance criteria, and the
dependency graph. #223 is ready; dependent slices are explicitly blocked.

### Product and platform work

- UX technical discovery: #232-#235.
- Active form implementation: #236, linked to existing PR #210.
- Permission-gating coverage and adoption: #237-#239; #237 is linked to
  existing PR #205.
- Chromatic human-review guidance: #240, linked to existing PR #202.
- Changelog follow-up refinement: #241 consolidates five underspecified tasks.
- Support, diagnostics, and impersonation: #242 consolidates the active
  subtree into the approval-gate discovery already defined by
  `docs/discovery/implementation-roadmap.md`. Its downstream implementation
  slices are intentionally not marked agent-ready while required decisions
  remain unresolved.
- Tenant invitation lifecycle: #243-#245, with dependencies represented in
  the issue bodies.
- Tenant access-administration UI: #246, dependent on existing issue #214.
- Usernames: #247.
- Managed Identity and Entra-only database authentication: #248-#250, with
  the Service Bus and Entra-only work dependent on #248.

All migrated issue bodies contain enough public technical context to proceed
or refine without opening ClickUp. Sensitive customer, commercial, pricing,
credential, and private planning content was not copied.

## Consolidated and excluded work

- Tenant access reads and group membership were already delivered by PRs
  #192 and #193. Role-assignment commands were already represented by #214
  and PR #220. The remaining UI became #246; no duplicate epic was created.
- Stale non-complete statuses backed by merged PRs were treated as delivered.
  Examples include PRs #57, #59, #70, #76, #78, #82, #185, #203, and #204.
- The support/error/impersonation parent discovery was already merged in PR
  #122 and its repository roadmap is authoritative. Active child entries were
  consolidated into #242 until approval gates are resolved, avoiding dozens
  of falsely ready tickets.
- ClickUp-specific portions of the old agent-wake and compatibility tooling
  were not migrated as new product work because the GitHub-native cutover
  supersedes them. Still-relevant open implementation was preserved in #240.
- Completed, obsolete, historical, and duplicate records remain in ClickUp
  for archaeology and are not GitHub backlog items.

## Verification

- Delivery pagination completed without HTTP 429.
- Exact legacy-ID/title searches and open/merged PR inventories were used for
  duplicate detection.
- Existing PRs #202, #205, and #210 now contain closing keywords for #240,
  #237, and #236 respectively.
- New issues were added to the GitHub Project by its item-added automation.
- This document contains no credentials, private customer data, or commercial
  material.

Final ClickUp Delivery archiving and removal of transitional ClickUp tooling
remain owned by #178 after #177 and #184 close.
